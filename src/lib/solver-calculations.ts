
import type { SolverFormValues, OpticalResponsePoint } from '@/types/solver';

// Complex Number Utilities
type Complex = { re: number; im: number };

function complex(re: number, im: number = 0): Complex { return { re, im }; }
const C_ZERO = complex(0, 0);
const C_ONE = complex(1, 0);
const C_I = complex(0, 1);
const C_I_NEG = complex(0, -1);

function cadd(a: Complex, b: Complex): Complex { return complex(a.re + b.re, a.im + b.im); }
function csub(a: Complex, b: Complex): Complex { return complex(a.re - b.re, a.im - b.im); }
function cmul(a: Complex, b: Complex): Complex {
  return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}
function cdiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return complex(NaN, NaN); // Division by zero
  return complex(
    (a.re * b.re + a.im * b.im) / denom,
    (a.im * b.re - a.re * b.im) / denom
  );
}
function cabsSq(a: Complex): number { return a.re * a.re + a.im * a.im; }
function cmulReal(a: Complex, r: number): Complex { return complex(a.re * r, a.im * r); }
function cexp(z: Complex): Complex {
  const expRe = Math.exp(z.re);
  return complex(expRe * Math.cos(z.im), expRe * Math.sin(z.im));
}
function cprod(arr: Complex[]): Complex {
    if (arr.length === 0) return C_ONE;
    return arr.reduce((acc, val) => cmul(acc, val), C_ONE);
}


// Matrix Utilities (2x2 Complex)
type Matrix2x2C = [[Complex, Complex], [Complex, Complex]];

function mmul2x2c(A: Matrix2x2C, B: Matrix2x2C): Matrix2x2C {
  return [
    [cadd(cmul(A[0][0], B[0][0]), cmul(A[0][1], B[1][0])), cadd(cmul(A[0][0], B[0][1]), cmul(A[0][1], B[1][1]))],
    [cadd(cmul(A[1][0], B[0][0]), cmul(A[1][1], B[1][0])), cadd(cmul(A[1][0], B[0][1]), cmul(A[1][1], B[1][1]))]
  ];
}
const M_IDENTITY: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];

const PI = Math.PI;
const NUM_POINTS = 200; // Number of points for the wavelength scan
const FP_TOLERANCE = 1e-9; // Floating point tolerance

export async function calculateOpticalResponse(
  params: SolverFormValues
): Promise<OpticalResponsePoint[]> {
  const results: OpticalResponsePoint[] = [];

  const {
    incidentMediumRefractiveIndex: n_incident_raw,
    substrateMediumRefractiveIndex: n_substrate_raw,
    numLayers,
    thickness: thicknesses_nm, // array of numbers
    refractiveIndex: layerRefractiveIndices_raw, // array of {n, k}
    angleOfIncidence: angle_deg,
    polarization, // 'TE' or 'TM'
    minWavelength: minWavelength_nm,
    maxWavelength: maxWavelength_nm,
  } = params;

  if (minWavelength_nm <= 0 || maxWavelength_nm <= 0 || minWavelength_nm >= maxWavelength_nm) {
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
        const wavelength_nm_iter = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
        results.push({ wavelength: wavelength_nm_iter, reflectance: 0, transmittance: 0, absorptance: 0 });
    }
    return results;
  }

  const incident_angle_rad = angle_deg * PI / 180.0;

  // Populate n_list_complex and d_list
  const n_list_complex: Complex[] = [
    complex(n_incident_raw.n, n_incident_raw.k),
    ...layerRefractiveIndices_raw.map(ri => complex(ri.n, ri.k)),
    complex(n_substrate_raw.n, n_substrate_raw.k)
  ];

  const d_list_nm: number[] = [
    Infinity, // Incident medium thickness
    ...thicknesses_nm,
    Infinity  // Substrate medium thickness
  ];

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    let wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) wavelength_nm = 1e-9; // Avoid zero or negative wavelength

    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationSucceeded = true;

    // Step 1: Snell's Law (using real parts of n for angles, as per Python code)
    const angles_rad_real: number[] = [incident_angle_rad];
    for (let i = 1; i < n_list_complex.length; i++) {
      const n_prev_real = n_list_complex[i - 1].re;
      const n_curr_real = n_list_complex[i].re;
      let angle_i_rad = NaN;

      if (Math.abs(n_curr_real) < FP_TOLERANCE) {
        calculationSucceeded = false; break;
      }
      const sin_theta_prev = Math.sin(angles_rad_real[i - 1]);
      const arg_asin = (n_prev_real / n_curr_real) * sin_theta_prev;

      if (arg_asin >= -1.0 - FP_TOLERANCE && arg_asin <= 1.0 + FP_TOLERANCE) {
        angle_i_rad = Math.asin(Math.max(-1.0, Math.min(1.0, arg_asin)));
      } else {
        calculationSucceeded = false; break; // TIR or unphysical based on real Snell's
      }
      if (isNaN(angle_i_rad)) {
        calculationSucceeded = false; break;
      }
      angles_rad_real.push(angle_i_rad);
    }

    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }

    // Step 2: Fresnel Coefficients
    const r_coeffs: Complex[] = [];
    const t_coeffs: Complex[] = [];

    for (let i = 0; i < n_list_complex.length - 1; i++) {
      const n1_complex = n_list_complex[i];
      const n2_complex = n_list_complex[i + 1];
      const theta1_real = angles_rad_real[i];
      const theta2_real = angles_rad_real[i + 1];

      // Check for NaN angles from Snell's law
      if (isNaN(theta1_real) || isNaN(theta2_real)) {
        calculationSucceeded = false; break;
      }

      const cos_theta1 = Math.cos(theta1_real);
      const cos_theta2 = Math.cos(theta2_real);

      let r_ij: Complex, t_ij: Complex;

      if (polarization === 'TM') { // P-polarization
        const term1_r_num = cmul(cmulReal(n1_complex, -1), complex(cos_theta2));
        const term2_r_num = cmul(n2_complex, complex(cos_theta1));
        const num_r = cadd(term1_r_num, term2_r_num);

        const term1_r_den = cmul(n1_complex, complex(cos_theta2));
        const term2_r_den = cmul(n2_complex, complex(cos_theta1));
        const den_r = cadd(term1_r_den, term2_r_den);
        r_ij = cdiv(num_r, den_r);

        const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
        const den_t = den_r;
        t_ij = cdiv(num_t, den_t);

      } else { // TE / S-polarization
        const num_r = csub(cmul(n1_complex, complex(cos_theta1)), cmul(n2_complex, complex(cos_theta2)));
        const den_r = cadd(cmul(n1_complex, complex(cos_theta1)), cmul(n2_complex, complex(cos_theta2)));
        r_ij = cdiv(num_r, den_r);
        
        const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
        const den_t = den_r;
        t_ij = cdiv(num_t, den_t);
      }
      if (isNaN(r_ij.re) || isNaN(t_ij.re)) { calculationSucceeded = false; break; }
      r_coeffs.push(r_ij);
      t_coeffs.push(t_ij);
    }
    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }

    // Step 3: Phase factors
    const delta_phases_complex: Complex[] = [C_ZERO]; 
    for (let i = 1; i < d_list_nm.length - 1; i++) { // Iterate through finite thickness layers
      const d_nm_layer = d_list_nm[i];
      if (d_nm_layer < 0) { calculationSucceeded = false; break; }
      if (Math.abs(d_nm_layer) < FP_TOLERANCE) {
        delta_phases_complex.push(C_ZERO); continue;
      }

      const n_layer_complex = n_list_complex[i];
      const theta_layer_real = angles_rad_real[i];
      if (isNaN(theta_layer_real)) { calculationSucceeded = false; break; }
      
      const cos_theta_layer = Math.cos(theta_layer_real);
      const num = cmulReal(cmul(n_layer_complex, complex(cos_theta_layer)), 2 * PI * d_nm_layer);
      const delta_i = cdiv(num, complex(wavelength_nm));
      if (isNaN(delta_i.re)) { calculationSucceeded = false; break; }
      delta_phases_complex.push(delta_i);
    }
     if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }
    
    // Step 4: Transfer Matrix
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]]; 
    for (let i = 0; i < r_coeffs.length; i++) { // This loop should go up to numLayers + 1 interfaces
      const r_i = r_coeffs[i];
      // The Python code uses delta[i] which corresponds to the phase shift *before* the i-th interface, accumulated in the (i-1)th layer.
      // In our delta_phases_complex, delta_phases_complex[0] is for the incident side (phase=0)
      // delta_phases_complex[j] is for layer j (1-indexed layers)
      // The P matrix for interface 'i' should use the phase accumulated in layer 'i' (if 'i' is a layer index).
      // The Python code's delta has "0" as the first element, then phases for layers.
      // So P for interface i (between layer i-1 and i) uses delta[i] (from layer i).
      // Our delta_phases_complex[0] is for incident, delta_phases_complex[1] for layer 1, etc.
      // The r_coeffs[i] is for interface i -> i+1.
      // The delta used in P should be associated with the layer the light is *in* before hitting interface i.
      // If P is the matrix for the interface i, it seems Python code's delta[i] is phase from layer i.
      // The interpretation here needs care. Let's assume delta_phases_complex[i] is phase for layer i.
      // Interface 0: incident to layer 1. Uses delta_phases_complex[0] (which is 0).
      // Interface 1: layer 1 to layer 2. Uses delta_phases_complex[1].
      // Interface N: layer N to substrate. Uses delta_phases_complex[N].
      const current_delta_complex = delta_phases_complex[i] ?? C_ZERO;


      if (isNaN(r_i.re) || isNaN(r_i.im) || isNaN(current_delta_complex.re) || isNaN(current_delta_complex.im)) {
        calculationSucceeded = false; break;
      }

      const exp_neg_i_delta = cexp(cmul(C_I_NEG, current_delta_complex));
      const exp_pos_i_delta = cexp(cmul(C_I, current_delta_complex));

      const P_matrix: Matrix2x2C = [
        [exp_neg_i_delta, cmul(r_i, exp_neg_i_delta)],
        [cmul(r_i, exp_pos_i_delta), exp_pos_i_delta],
      ];
      M_total = mmul2x2c(M_total, P_matrix);
      if (isNaN(M_total[0][0].re)) { calculationSucceeded = false; break; }
    }
    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }

    // Step 5: R, T, A
    const t_product_complex = cprod(t_coeffs);
    if (isNaN(t_product_complex.re)) {
        results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
        continue;
    }

    let R_val_calc: number;
    if (cabsSq(M_total[0][0]) < FP_TOLERANCE) {
        R_val_calc = 1; // Avoid division by zero, assume total reflection or problematic case
    } else {
        R_val_calc = cabsSq(cdiv(M_total[1][0], M_total[0][0]));
    }
    R_val_calc = isNaN(R_val_calc) ? 0.0 : R_val_calc;


    const n_incident_complex = n_list_complex[0];
    const n_substrate_complex = n_list_complex[n_list_complex.length - 1];
    const theta_incident_real = angles_rad_real[0];
    const theta_substrate_real = angles_rad_real[angles_rad_real.length - 1];

    let power_transfer_ratio_real = 0;
    if (!isNaN(theta_incident_real) && !isNaN(theta_substrate_real) && Math.abs(n_incident_complex.re * Math.cos(theta_incident_real)) > FP_TOLERANCE) {
        power_transfer_ratio_real = (n_substrate_complex.re * Math.cos(theta_substrate_real)) / (n_incident_complex.re * Math.cos(theta_incident_real));
    }
    if (isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0) power_transfer_ratio_real = 0;


    let T_val_calc: number;
    if (cabsSq(M_total[0][0]) < FP_TOLERANCE) {
        T_val_calc = 0; // Avoid division by zero
    } else {
        T_val_calc = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));
    }
    T_val_calc = isNaN(T_val_calc) ? 0.0 : T_val_calc;

    // Final Clamping and Absorptance Calculation
    R_calc = Math.max(0, Math.min(1, R_val_calc));
    T_calc = Math.max(0, Math.min(1, T_val_calc));

    if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
        if (R_calc >= 1.0 - FP_TOLERANCE) {
            T_calc = 0.0;
            R_calc = 1.0; 
        } else {
            T_calc = 1.0 - R_calc;
        }
    }
    
    A_calc = 1.0 - R_calc - T_calc;
    A_calc = Math.max(0, Math.min(1, A_calc));
    
    // Ensure T_calc is consistent after A_calc is potentially clamped (e.g. A_calc becomes 0 if it was slightly negative)
    T_calc = 1.0 - R_calc - A_calc;
    T_calc = Math.max(0, Math.min(1, T_calc)); // Final clamp for T

    results.push({
      wavelength: wavelength_nm,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return results;
}

    