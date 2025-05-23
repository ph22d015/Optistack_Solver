
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
function cexp(z: Complex): Complex {
  const expRe = Math.exp(z.re);
  return complex(expRe * Math.cos(z.im), expRe * Math.sin(z.im));
}
function cmulReal(a: Complex, r: number): Complex { return complex(a.re * r, a.im * r); }

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
const FP_TOLERANCE = 1e-9;

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
        const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
    }
    return results;
  }

  const incident_angle_rad = angle_deg * PI / 180.0;

  // Populate n_list_complex and d_list
  const n_list_complex: Complex[] = [complex(n_incident_raw.n, n_incident_raw.k)];
  for (const ri of layerRefractiveIndices_raw) {
    n_list_complex.push(complex(ri.n, ri.k));
  }
  n_list_complex.push(complex(n_substrate_raw.n, n_substrate_raw.k));

  const d_list_nm: number[] = [Infinity]; // Incident medium thickness
  for (const t of thicknesses_nm) {
    d_list_nm.push(t);
  }
  d_list_nm.push(Infinity); // Substrate medium thickness


  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    let wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) wavelength_nm = 1e-9; // Avoid zero or negative wavelength

    let R_calc = NaN, T_calc = NaN, A_calc = NaN;

    // Step 1: Snell's Law (using real parts of n for angles, as per Python code)
    const angles_rad_real: number[] = [incident_angle_rad];
    let snell_possible = true;
    for (let i = 1; i < n_list_complex.length; i++) {
      const n_prev_real = n_list_complex[i - 1].re;
      const n_curr_real = n_list_complex[i].re;
      let angle_i_rad = NaN;
      if (Math.abs(n_curr_real) < FP_TOLERANCE) { // Avoid division by zero if current layer's n_real is zero
        snell_possible = false;
        break;
      }
      const sin_theta_prev = Math.sin(angles_rad_real[i - 1]);
      const arg_asin = (n_prev_real / n_curr_real) * sin_theta_prev;
      if (arg_asin >= -1.0 - FP_TOLERANCE && arg_asin <= 1.0 + FP_TOLERANCE) {
        angle_i_rad = Math.asin(Math.max(-1.0, Math.min(1.0, arg_asin))); // Clamp arg to avoid Math.asin NaN for values just outside due to precision
      } else {
        // TIR condition or unphysical scenario based on real Snell's law
        snell_possible = false; // Mark as not possible and will lead to NaN results later.
        break;
      }
      angles_rad_real.push(angle_i_rad);
    }

    if (!snell_possible) {
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
        continue;
    }

    // Step 2: Fresnel Coefficients (using complex n and real angles)
    const r_coeffs: Complex[] = [];
    const t_coeffs: Complex[] = [];
    let fresnel_calc_possible = true;

    for (let i = 0; i < n_list_complex.length - 1; i++) {
      const n1_complex = n_list_complex[i];
      const n2_complex = n_list_complex[i + 1];
      const theta1_real = angles_rad_real[i];
      const theta2_real = angles_rad_real[i + 1];

      if (isNaN(theta1_real) || isNaN(theta2_real)) {
        fresnel_calc_possible = false;
        break;
      }

      const cos_theta1 = Math.cos(theta1_real);
      const cos_theta2 = Math.cos(theta2_real);

      let r_ij: Complex, t_ij: Complex;

      if (polarization === 'TM') { // P-polarization
        // num_r = -n1*cos_theta2 + n2*cos_theta1
        const term1_r_num = cmul(cmulReal(n1_complex, -1), complex(cos_theta2));
        const term2_r_num = cmul(n2_complex, complex(cos_theta1));
        const num_r = cadd(term1_r_num, term2_r_num);

        // den_r = n1*cos_theta2 + n2*cos_theta1
        const term1_r_den = cmul(n1_complex, complex(cos_theta2));
        const term2_r_den = cmul(n2_complex, complex(cos_theta1));
        const den_r = cadd(term1_r_den, term2_r_den);
        r_ij = cdiv(num_r, den_r);

        // num_t = 2*n1*cos_theta1
        const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
        // den_t = n2*cos_theta1 + n1*cos_theta2 (same as den_r for P-pol in Python code)
        const den_t = den_r; // In your Python, den_r for P-pol is n1*cos(theta2) + n2*cos(theta1)
                               // and den_t is n2*cos(theta1) + n1*cos(theta2). These are the same.
        t_ij = cdiv(num_t, den_t);

      } else { // TE / S-polarization
        // num_r = n1*cos_theta1 - n2*cos_theta2
        const num_r = csub(cmul(n1_complex, complex(cos_theta1)), cmul(n2_complex, complex(cos_theta2)));
        // den_r = n1*cos_theta1 + n2*cos_theta2
        const den_r = cadd(cmul(n1_complex, complex(cos_theta1)), cmul(n2_complex, complex(cos_theta2)));
        r_ij = cdiv(num_r, den_r);
        
        // num_t = 2*n1*cos_theta1
        const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
        // den_t = n1*cos_theta1 + n2*cos_theta2 (same as den_r for S-pol)
        const den_t = den_r;
        t_ij = cdiv(num_t, den_t);
      }
      r_coeffs.push(r_ij);
      t_coeffs.push(t_ij);
    }
    
    if (!fresnel_calc_possible) {
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
        continue;
    }

    // Step 3: Phase factors (delta_phases_complex)
    const delta_phases_complex: Complex[] = [C_ZERO]; // Phase for incident medium side of 1st interface.
    let phase_calc_possible = true;
    for (let i = 1; i < d_list_nm.length - 1; i++) { // Iterate through finite thickness layers
      const d_nm = d_list_nm[i];
      if (d_nm < 0) { // Negative thickness is unphysical
        phase_calc_possible = false;
        break;
      }
      if (Math.abs(d_nm) < FP_TOLERANCE) { // Zero thickness layer effectively
        delta_phases_complex.push(C_ZERO);
        continue;
      }

      const n_layer_complex = n_list_complex[i];
      const theta_layer_real = angles_rad_real[i];

      if (isNaN(theta_layer_real)) {
         phase_calc_possible = false;
         break;
      }
      
      const cos_theta_layer = Math.cos(theta_layer_real);
      // delta = 2*pi*N*d*cos(theta)/lambda
      const num = cmulReal(cmul(n_layer_complex, complex(cos_theta_layer)), 2 * PI * d_nm);
      const delta_i = cdiv(num, complex(wavelength_nm));
      delta_phases_complex.push(delta_i);
    }

    if (!phase_calc_possible) {
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
        continue;
    }
    
    // Step 4: Transfer Matrix
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]]; // Deep copy
    let matrix_calc_possible = true;

    for (let i = 0; i < r_coeffs.length; i++) {
      const r_i = r_coeffs[i];
      const delta_i_complex = delta_phases_complex[i]; 

      if (isNaN(r_i.re) || isNaN(r_i.im) || isNaN(delta_i_complex.re) || isNaN(delta_i_complex.im)) {
          matrix_calc_possible = false;
          break;
      }

      const P_matrix: Matrix2x2C = [
        [cexp(cmul(C_I_NEG, delta_i_complex)), cmul(r_i, cexp(cmul(C_I_NEG, delta_i_complex)))],
        [cmul(r_i, cexp(cmul(C_I, delta_i_complex))), cexp(cmul(C_I, delta_i_complex))],
      ];
      M_total = mmul2x2c(M_total, P_matrix);
    }

    if (!matrix_calc_possible || isNaN(M_total[0][0].re) || isNaN(M_total[1][0].re) || Math.abs(M_total[0][0].re) < FP_TOLERANCE && Math.abs(M_total[0][0].im) < FP_TOLERANCE) {
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
        continue;
    }

    // Step 5: R, T, A
    let t_product_complex = C_ONE;
    for (const t_val of t_coeffs) {
        if (isNaN(t_val.re) || isNaN(t_val.im)) {
            t_product_complex = complex(NaN,NaN);
            break;
        }
      t_product_complex = cmul(t_product_complex, t_val);
    }
    
    if (isNaN(t_product_complex.re)) {
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
        continue;
    }

    R_calc = cabsSq(cdiv(M_total[1][0], M_total[0][0]));

    const n_incident_medium_complex = n_list_complex[0];
    const n_substrate_medium_complex = n_list_complex[n_list_complex.length - 1];
    const theta_incident_real = angles_rad_real[0];
    const theta_substrate_real = angles_rad_real[angles_rad_real.length - 1];

    let power_transfer_ratio_real = 0;
    if (!isNaN(theta_incident_real) && !isNaN(theta_substrate_real) && 
        Math.abs(n_incident_medium_complex.re * Math.cos(theta_incident_real)) > FP_TOLERANCE) {
      power_transfer_ratio_real = (n_substrate_medium_complex.re * Math.cos(theta_substrate_real)) / 
                                  (n_incident_medium_complex.re * Math.cos(theta_incident_real));
    }
     if (isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0) power_transfer_ratio_real = 0; // If TIR in substrate or incident medium not propagating

    T_calc = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));

    // Final clamping and Absorptance
    R_calc = isNaN(R_calc) ? 0 : Math.max(0, Math.min(1, R_calc));
    T_calc = isNaN(T_calc) ? 0 : Math.max(0, Math.min(1, T_calc));

    // If R+T > 1 due to precision, adjust T. This prioritizes R.
    if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
        if (R_calc >= 1.0 - FP_TOLERANCE) { // If R is already ~1
            T_calc = 0.0;
            R_calc = 1.0; // Ensure R doesn't exceed 1
        } else {
            T_calc = 1.0 - R_calc;
        }
    }
    
    A_calc = 1.0 - R_calc - T_calc;
    A_calc = Math.max(0, Math.min(1, A_calc)); // Ensure A is not negative due to precision
    
    // Final check to ensure T is consistent after A is potentially clamped.
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
