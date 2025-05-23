
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
// function cabs(a: Complex): number { return Math.sqrt(cabsSq(a)); } // Not currently used
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
    thickness: thicknesses_nm, 
    refractiveIndex: layerRefractiveIndices_param, 
    angleOfIncidence: angle_deg_param,
    polarization,
    minWavelength: minWavelength_nm,
    maxWavelength: maxWavelength_nm,
  } = params;

  const n_list_complex: Complex[] = [
    complex(n_incident_param.n, n_incident_param.k),
    ...layerRefractiveIndices_param.map(ri => complex(ri.n, ri.k)),
    complex(n_substrate_param.n, n_substrate_param.k)
  ];

  const d_list_nm: number[] = [
    Infinity,
    ...thicknesses_nm.map(t => (t < 0 ? 0 : t)), 
    Infinity
  ];

  const angle_deg = isNaN(angle_deg_param) ? 0 : angle_deg_param;
  const incident_angle_rad = angle_deg * PI / 180.0;

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    let wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= FP_TOLERANCE) wavelength_nm = FP_TOLERANCE;

    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationSucceeded = true;

    // Step 1: Snell's Law (using real parts of n for angles)
    const angles_rad_real: number[] = [incident_angle_rad];
    if (isNaN(incident_angle_rad)) { // Should not happen with current form validation
        calculationSucceeded = false;
    }

    if(calculationSucceeded) {
        for (let i = 1; i < n_list_complex.length; i++) {
            const n_prev_real = n_list_complex[i - 1].re;
            const n_curr_real = n_list_complex[i].re;
            let angle_i_rad = NaN;

            if (Math.abs(n_curr_real) < FP_TOLERANCE) {
                angle_i_rad = (Math.abs(n_prev_real * Math.sin(angles_rad_real[i - 1])) < FP_TOLERANCE) ? 0 : NaN;
            } else {
                if (isNaN(angles_rad_real[i-1])) { // Check if previous angle was NaN
                    angle_i_rad = NaN;
                } else {
                    const sin_theta_prev = Math.sin(angles_rad_real[i - 1]);
                    const arg_asin = (n_prev_real / n_curr_real) * sin_theta_prev;

                    if (arg_asin >= -1.0 - FP_TOLERANCE && arg_asin <= 1.0 + FP_TOLERANCE) {
                        angle_i_rad = Math.asin(Math.max(-1.0, Math.min(1.0, arg_asin)));
                    } else {
                        angle_i_rad = NaN; 
                    }
                }
            }
            if (isNaN(angle_i_rad)) { calculationSucceeded = false; break; }
            angles_rad_real.push(angle_i_rad);
        }
    }


    // Step 2: Fresnel Coefficients
    const r_coeffs_complex: Complex[] = [];
    const t_coeffs_complex: Complex[] = [];

    if (calculationSucceeded) {
        for (let i = 0; i < n_list_complex.length - 1; i++) {
            const n1_complex = n_list_complex[i];
            const n2_complex = n_list_complex[i + 1];
            const theta1_real = angles_rad_real[i];
            const theta2_real = angles_rad_real[i + 1];
            
            if (isNaN(theta1_real) || isNaN(theta2_real)) { // Should have been caught by calculationSucceeded
                calculationSucceeded = false; break;
            }
            
            const cos_theta1 = Math.cos(theta1_real);
            const cos_theta2 = Math.cos(theta2_real);
            
            let r_ij: Complex, t_ij: Complex;

            if (polarization === 'TM') { 
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
                t_ij = cdiv(num_t, den_r); 
            }

            if (isNaN(r_ij.re) || isNaN(r_ij.im) || isNaN(t_ij.re) || isNaN(t_ij.im)) {
                calculationSucceeded = false; break;
            }
            r_coeffs_complex.push(r_ij);
            t_coeffs_complex.push(t_ij);
        }
    }
    
    // Step 3: Phase factors
    const delta_phases_complex: Complex[] = [C_ZERO]; 
    if(calculationSucceeded) {
        for (let i = 1; i < d_list_nm.length - 1; i++) { 
            const d_nm_layer = d_list_nm[i];
            if (d_nm_layer < 0) { calculationSucceeded = false; break; }
            if (Math.abs(d_nm_layer) < FP_TOLERANCE) { 
                delta_phases_complex.push(C_ZERO); 
                continue;
            }

            const N_layer_complex = n_list_complex[i];
            const theta_layer_real = angles_rad_real[i];
            if (isNaN(theta_layer_real)) { calculationSucceeded = false; break; }
            
            const cos_theta_layer = Math.cos(theta_layer_real);
            const term_N_cos_d = cmulReal(cmul(N_layer_complex, complex(cos_theta_layer)), d_nm_layer);
            const num = cmulReal(term_N_cos_d, 2 * PI);
            const delta_i = cdiv(num, complex(wavelength_nm));
            
            if (isNaN(delta_i.re) || isNaN(delta_i.im)) { calculationSucceeded = false; break; }
            delta_phases_complex.push(delta_i);
        }
    }
        
    // Step 4: Transfer Matrix
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]];
    if(calculationSucceeded) {
        for (let i = 0; i < r_coeffs_complex.length; i++) { 
            const r_i = r_coeffs_complex[i];
            // delta_phases_complex[0] is for incident medium interface (phase effect "before" first layer)
            // The Python code uses delta[i] which corresponds to the phase shift *within* layer i (our n_list_complex[i])
            // if delta_phases_complex is indexed from 0 to num_layers_internal, then delta_phases_complex[i] is correct for r_coeffs_complex[i]
            // The original Python code's delta has `delta[0]=0`, and `delta[i]` for `i>0` is for layer `i` (which is `n_list[i]`, `d_list[i]`).
            // P matrix for interface 'i' (between medium i and i+1) uses r_coeffs_complex[i] and phase from medium 'i'.
            // delta_phases_complex[0] is for the incident medium to layer 1 interface, using phase related to incident medium (which is 0 if d_incident = inf or if we consider the phase shift just before it enters layer 1)
            // The reference point for phases in TMM can be tricky. The Python code's P matrix `P_i = [[exp(-j*delta_i), r_i*exp(-j*delta_i)], [r_i*exp(j*delta_i), exp(j*delta_i)]]` suggests delta_i is the phase accumulated *before* reflecting at interface i.
            // Our delta_phases_complex[0] is C_ZERO.  delta_phases_complex[1] is for the first layer.
            // r_coeffs_complex[0] is r_01. r_coeffs_complex[1] is r_12.
            // M = P0 * P1 * ... * PN-1, where Pi is for interface i to i+1.
            // The Python code's M = M @ P loop: `i` goes from 0 to `len(r)-1`. `delta[i]` is used.
            // So `delta_phases_complex[i]` should correspond to `delta[i]` in Python.
            const delta_i_complex = delta_phases_complex[i]; 

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
    }


    if (!calculationSucceeded) {
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue; 
    }

    // Step 5: R, T, A
    let t_product_complex = C_ONE;
    t_coeffs_complex.forEach(t_val => {
        if(isNaN(t_val.re) || isNaN(t_val.im)) { calculationSucceeded = false; } // Should not happen if previous checks are fine
        t_product_complex = cmul(t_product_complex, t_val);
    });
     if (isNaN(t_product_complex.re) || isNaN(t_product_complex.im)) {
        calculationSucceeded = false;
    }

    if (!calculationSucceeded) { // Re-check before final RTA calculation
      results.push({ wavelength: wavelength_nm, reflectance: 0, transmittance: 0, absorptance: 0 });
      continue;
    }
    
    let R_val_calc: number;
    let T_val_calc: number;

    if (cabsSq(M_total[0][0]) < FP_TOLERANCE || isNaN(M_total[0][0].re) || isNaN(M_total[0][0].im) || isNaN(M_total[1][0].re) || isNaN(M_total[1][0].im)) {
        R_val_calc = NaN; 
    } else {
        R_val_calc = cabsSq(cdiv(M_total[1][0], M_total[0][0]));
    }

    const n_inc_val_real = n_list_complex[0].re; 
    const n_sub_val_real = n_list_complex[n_list_complex.length - 1].re; 
    const theta_inc_real = angles_rad_real[0];
    const theta_sub_real = angles_rad_real[angles_rad_real.length - 1];

    let power_transfer_ratio_real = NaN;
    if (!(isNaN(theta_inc_real) || isNaN(theta_sub_real) || 
        isNaN(n_inc_val_real) || isNaN(n_sub_val_real) ||
        Math.abs(n_inc_val_real) < FP_TOLERANCE || Math.abs(Math.cos(theta_inc_real)) < FP_TOLERANCE )) {
        
        const n_inc_eff_real = n_inc_val_real * Math.cos(theta_inc_real);
        const n_sub_eff_real = n_sub_val_real * Math.cos(theta_sub_real);

        if (Math.abs(n_inc_eff_real) >= FP_TOLERANCE) {
             power_transfer_ratio_real = n_sub_eff_real / n_inc_eff_real;
        }
    }
        
    if (isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0 ) { 
        power_transfer_ratio_real = 0; // Default to 0 if calculation failed or unphysical
    }

    if (cabsSq(M_total[0][0]) < FP_TOLERANCE || isNaN(M_total[0][0].re) || isNaN(M_total[0][0].im) || isNaN(t_product_complex.re) || isNaN(t_product_complex.im) ) {
        T_val_calc = NaN;
    } else {
        T_val_calc = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));
    }
    
    // Ensure R_calc and T_calc are not NaN before clamping
    R_calc = isNaN(R_val_calc) ? 0.0 : R_val_calc;
    T_calc = isNaN(T_val_calc) ? 0.0 : T_val_calc;

    // Clamp R and T to [0, 1]
    R_calc = Math.max(0, Math.min(1, R_calc));
    T_calc = Math.max(0, Math.min(1, T_calc));
    
    // Adjust T if R+T > 1 due to precision
    if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
        if (R_calc >= 1.0 - FP_TOLERANCE) { 
            T_calc = 0.0;
            R_calc = 1.0; // Clamp R precisely if it's already ~1
        } else { // Otherwise, adjust T based on R
            T_calc = 1.0 - R_calc;
        }
    }
    
    A_calc = 1.0 - R_calc - T_calc;
    A_calc = Math.max(0, Math.min(1, A_calc)); // Ensure A is not negative
    
    // Final consistency check for T after A is derived and clamped
    // This ensures R+T+A = 1 rigorously by adjusting T last
    T_calc = 1.0 - R_calc - A_calc; 
    T_calc = Math.max(0, Math.min(1, T_calc)); // And ensure T is still valid

    results.push({
      wavelength: wavelength_nm,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return results;
}
