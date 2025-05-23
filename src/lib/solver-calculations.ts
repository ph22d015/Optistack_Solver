
import type { SolverFormValues, OpticalResponsePoint, ComplexRefractiveIndexSchema as ComplexRI } from '@/types/solver';

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
  if (denom === 0) return complex(NaN, NaN); // Avoid division by zero
  return complex(
    (a.re * b.re + a.im * b.im) / denom,
    (a.im * b.re - a.re * b.im) / denom
  );
}
function cabsSq(a: Complex): number { return a.re * a.re + a.im * a.im; }
function cabs(a: Complex): number { return Math.sqrt(cabsSq(a)); }
function cmulReal(a: Complex, r: number): Complex { return complex(a.re * r, a.im * r); }

function cexp(z: Complex): Complex {
    const expRe = Math.exp(z.re);
    return complex(expRe * Math.cos(z.im), expRe * Math.sin(z.im));
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
const NUM_POINTS = 200;
const FP_TOLERANCE = 1e-12; // Floating point tolerance

export async function calculateOpticalResponse(
  params: SolverFormValues
): Promise<OpticalResponsePoint[]> {
  const results: OpticalResponsePoint[] = [];

  const {
    incidentMediumRefractiveIndex: n_incident_param,
    substrateMediumRefractiveIndex: n_substrate_param,
    numLayers,
    thickness: thicknesses_nm, // These are for the internal layers only
    refractiveIndex: layerRefractiveIndices_param, // For internal layers
    angleOfIncidence: angle_deg_param,
    polarization,
    minWavelength: minWavelength_nm,
    maxWavelength: maxWavelength_nm,
  } = params;

  // Construct n_list_complex: [n_incident, n_layer1, ..., n_layer_m, n_substrate]
  const n_list_complex: Complex[] = [
    complex(n_incident_param.n, n_incident_param.k),
    ...layerRefractiveIndices_param.map(ri => complex(ri.n, ri.k)),
    complex(n_substrate_param.n, n_substrate_param.k)
  ];

  // Construct d_list: [Infinity, d_layer1, ..., d_layer_m, Infinity]
  // thicknesses_nm correspond to d_layer1 to d_layer_m
  const d_list_nm: number[] = [
    Infinity,
    ...thicknesses_nm.map(t => (t < 0 ? 0 : t)), // Ensure no negative thickness
    Infinity
  ];

  // Ensure angle_deg is not NaN
  const angle_deg = isNaN(angle_deg_param) ? 0 : angle_deg_param;
  const incident_angle_rad = angle_deg * PI / 180.0;

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    let wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= FP_TOLERANCE) wavelength_nm = FP_TOLERANCE;

    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationSucceeded = true;

    // Step 1: Snell's Law (using real parts of n for angles)
    const angles_rad_real: number[] = [incident_angle_rad];
    for (let i = 1; i < n_list_complex.length; i++) {
      const n_prev_real = n_list_complex[i - 1].re;
      const n_curr_real = n_list_complex[i].re;
      let angle_i_rad = NaN;

      if (Math.abs(n_curr_real) < FP_TOLERANCE) {
        angle_i_rad = (Math.abs(n_prev_real * Math.sin(angles_rad_real[i - 1])) < FP_TOLERANCE) ? 0 : NaN;
      } else {
        const sin_theta_prev = Math.sin(angles_rad_real[i - 1]);
        const arg_asin = (n_prev_real / n_curr_real) * sin_theta_prev;

        if (arg_asin >= -1.0 - FP_TOLERANCE && arg_asin <= 1.0 + FP_TOLERANCE) {
          angle_i_rad = Math.asin(Math.max(-1.0, Math.min(1.0, arg_asin)));
        } else {
          angle_i_rad = NaN; // TIR or unphysical based on real Snell's
        }
      }
      if (isNaN(angle_i_rad)) { calculationSucceeded = false; break; }
      angles_rad_real.push(angle_i_rad);
    }

    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }

    // Step 2: Fresnel Coefficients
    const r_coeffs_complex: Complex[] = [];
    const t_coeffs_complex: Complex[] = [];

    for (let i = 0; i < n_list_complex.length - 1; i++) {
      const n1_complex = n_list_complex[i];
      const n2_complex = n_list_complex[i + 1];
      const theta1_real = angles_rad_real[i];
      const theta2_real = angles_rad_real[i + 1];

      // This check for NaN angles from Snell's law is important.
      if (isNaN(theta1_real) || isNaN(theta2_real)) {
        calculationSucceeded = false;
        break;
      }
      
      const cos_theta1 = Math.cos(theta1_real);
      const cos_theta2 = Math.cos(theta2_real);
      
      let r_ij: Complex, t_ij: Complex;

      if (polarization === 'TM') { // P-polarization
        const term1_r_num = cmul(n2_complex, complex(cos_theta1)); 
        const term2_r_num = cmul(n1_complex, complex(cos_theta2)); 
        const num_r = csub(term1_r_num, term2_r_num);
        const den_r = cadd(term1_r_num, term2_r_num);
        r_ij = cdiv(num_r, den_r);

        const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
        const den_t_py = cadd(cmul(n2_complex, complex(cos_theta1)), cmul(n1_complex, complex(cos_theta2)));
        t_ij = cdiv(num_t, den_t_py);

      } else { // TE / S-polarization
        const term1_r_num = cmul(n1_complex, complex(cos_theta1));
        const term2_r_num = cmul(n2_complex, complex(cos_theta2));
        const num_r = csub(term1_r_num, term2_r_num);
        const den_r = cadd(term1_r_num, term2_r_num);
        r_ij = cdiv(num_r, den_r);
        
        const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
        t_ij = cdiv(num_t, den_r); // For S-pol, den_t is same as den_r in Python ref
      }

      if (isNaN(r_ij.re) || isNaN(r_ij.im) || isNaN(t_ij.re) || isNaN(t_ij.im)) {
        calculationSucceeded = false; break;
      }
      r_coeffs_complex.push(r_ij);
      t_coeffs_complex.push(t_ij);
    }
    
    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }

    // Step 3: Phase factors (delta_i for layer i's phase contribution)
    // d_list_nm: [inf, d_layer1, d_layer2, ..., d_layer_m, inf]
    // n_list_complex: [n_inc, n_layer1, n_layer2, ..., n_layer_m, n_sub]
    // angles_rad_real: [theta_inc, theta_layer1, theta_layer2, ..., theta_layer_m, theta_sub]
    // Python's delta: delta[0] is 0. delta[i] (for i>0) is for layer i (which is n_list_complex[i], d_list_nm[i], angles_rad_real[i])
    const delta_phases_complex: Complex[] = [C_ZERO]; // delta[0] in Python
    for (let i = 1; i < d_list_nm.length - 1; i++) { // Iterate through finite thickness layers
      const d_nm_layer = d_list_nm[i];
      if (d_nm_layer < 0) { calculationSucceeded = false; break; }
      if (Math.abs(d_nm_layer) < FP_TOLERANCE) { // Zero thickness layer
        delta_phases_complex.push(C_ZERO); 
        continue;
      }

      const N_layer_complex = n_list_complex[i];
      const theta_layer_real = angles_rad_real[i];
      if (isNaN(theta_layer_real)) { calculationSucceeded = false; break; }
      
      const cos_theta_layer = Math.cos(theta_layer_real);
      // delta_i = (2 * PI * N_layer * cos(theta_layer) * d_layer) / lambda
      const term_N_cos_d = cmulReal(cmul(N_layer_complex, complex(cos_theta_layer)), d_nm_layer);
      const num = cmulReal(term_N_cos_d, 2 * PI);
      const delta_i = cdiv(num, complex(wavelength_nm));
      
      if (isNaN(delta_i.re) || isNaN(delta_i.im)) { calculationSucceeded = false; break; }
      delta_phases_complex.push(delta_i);
    }
    
    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }
    
    // Step 4: Transfer Matrix
    // Python's M = M @ P loops `len(r)` times, which is num_interfaces = numLayers (internal) + 1
    // This loop runs for each interface.
    // r_coeffs_complex.length is n_list_complex.length - 1.
    // delta_phases_complex has same length as n_list_complex (up to substrate).
    // P matrix for interface 'i' (between medium i and i+1) uses r_coeffs_complex[i] and delta_phases_complex[i].
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]];
    for (let i = 0; i < r_coeffs_complex.length; i++) { 
      const r_i = r_coeffs_complex[i];
      const delta_i_complex = delta_phases_complex[i]; // delta[i] from Python logic

      if (isNaN(r_i.re) || isNaN(r_i.im) || isNaN(delta_i_complex.re) || isNaN(delta_i_complex.im)) {
        calculationSucceeded = false; break;
      }

      const exp_neg_i_delta = cexp(cmul(C_I_NEG, delta_i_complex));
      const exp_pos_i_delta = cexp(cmul(C_I, delta_i_complex));

      const P_matrix: Matrix2x2C = [
        [exp_neg_i_delta, cmul(r_i, exp_neg_i_delta)],
        [cmul(r_i, exp_pos_i_delta), exp_pos_i_delta]
      ];
      M_total = mmul2x2c(M_total, P_matrix);
      if (isNaN(M_total[0][0].re) || isNaN(M_total[0][0].im)) { calculationSucceeded = false; break; }
    }

    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }

    // Step 5: R, T, A
    let t_product_complex = C_ONE;
    t_coeffs_complex.forEach(t_val => {
        t_product_complex = cmul(t_product_complex, t_val);
    });
    if (isNaN(t_product_complex.re) || isNaN(t_product_complex.im)) {
        results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
        continue;
    }

    let R_val_calc: number;
    if (cabsSq(M_total[0][0]) < FP_TOLERANCE) { 
        R_val_calc = (cabsSq(M_total[1][0]) > FP_TOLERANCE) ? 1.0 : 0.0; 
    } else {
        R_val_calc = cabsSq(cdiv(M_total[1][0], M_total[0][0]));
    }
    
    let T_val_calc: number;
    const n_incident_val_real = n_list_complex[0].re; // Real part of incident n
    const n_substrate_val_real = n_list_complex[n_list_complex.length - 1].re; // Real part of substrate n
    const theta_incident_real = angles_rad_real[0];
    const theta_substrate_real = angles_rad_real[angles_rad_real.length - 1];

    let power_transfer_ratio_real = 0;
    if (isNaN(theta_incident_real) || isNaN(theta_substrate_real) || isNaN(n_incident_val_real) || isNaN(n_substrate_val_real)){
        power_transfer_ratio_real = NaN;
    } else {
        const n_inc_eff_real = n_incident_val_real * Math.cos(theta_incident_real);
        const n_sub_eff_real = n_substrate_val_real * Math.cos(theta_substrate_real);

        if (Math.abs(n_inc_eff_real) < FP_TOLERANCE) {
            power_transfer_ratio_real = NaN; 
        } else {
            power_transfer_ratio_real = n_sub_eff_real / n_inc_eff_real;
        }
    }
        
    if (isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0 ) { 
        power_transfer_ratio_real = 0; 
    }

    if (cabsSq(M_total[0][0]) < FP_TOLERANCE) {
        T_val_calc = 0; 
    } else {
        T_val_calc = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));
    }
    
    // Final Clamping and Absorptance Calculation
    R_calc = isNaN(R_val_calc) ? 0.0 : Math.max(0, Math.min(1, R_val_calc));
    T_calc = isNaN(T_val_calc) ? 0.0 : Math.max(0, Math.min(1, T_val_calc));

    // If R+T > 1 due to precision, adjust T.
    if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
        if (R_calc >= 1.0 - FP_TOLERANCE) { // If R is already ~1
            T_calc = 0.0;
            R_calc = 1.0; // Clamp R precisely
        } else { // Otherwise, adjust T based on R
            T_calc = 1.0 - R_calc;
        }
    }
    
    A_calc = 1.0 - R_calc - T_calc;
    A_calc = Math.max(0, Math.min(1, A_calc)); // Ensure A is not negative due to tiny errors
    
    // Final consistency check for T
    T_calc = 1.0 - R_calc - A_calc; 
    T_calc = Math.max(0, Math.min(1, T_calc));


    results.push({
      wavelength: wavelength_nm,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return results;
}

