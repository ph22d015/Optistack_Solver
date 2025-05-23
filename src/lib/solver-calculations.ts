
import type { SolverFormValues, OpticalResponsePoint, SweepParameter } from '@/types/solver';

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
const NUM_POINTS = 200; // Number of points for the sweep
const FP_TOLERANCE = 1e-12; // Floating point tolerance

export async function calculateOpticalResponse(
  params: SolverFormValues
): Promise<{ data: OpticalResponsePoint[], sweepParameter: SweepParameter }> {
  const results: OpticalResponsePoint[] = [];
  const sweepParameter = params.sweepType;

  const n_incident_medium_complex = complex(params.incidentMediumRefractiveIndex.n, params.incidentMediumRefractiveIndex.k);
  const n_substrate_medium_complex = complex(params.substrateMediumRefractiveIndex.n, params.substrateMediumRefractiveIndex.k);

  const internal_layer_refractive_indices_complex = params.refractiveIndex.map(ri => complex(ri.n, ri.k));
  const internal_layer_thicknesses_nm = params.thickness.map(t => (t < 0 ? 0 : t));

  const n_list_complex_full: Complex[] = [
    n_incident_medium_complex,
    ...internal_layer_refractive_indices_complex,
    n_substrate_medium_complex
  ];

  const d_list_nm_full: number[] = [
    Infinity, // Incident medium
    ...internal_layer_thicknesses_nm,
    Infinity  // Substrate medium
  ];

  const polarization = params.polarization;

  // Determine loop parameters based on sweepType
  let sweepVariableValues: number[] = [];
  let fixedAngleRad: number | undefined = undefined;
  let fixedWavelengthNm: number | undefined = undefined;

  if (params.sweepType === 'wavelength') {
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
      let val = params.minWavelength + (pointIdx * (params.maxWavelength - params.minWavelength)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
      if (val <= FP_TOLERANCE) val = FP_TOLERANCE;
      sweepVariableValues.push(val);
    }
    fixedAngleRad = (params.angleOfIncidence ?? 0) * PI / 180.0;
  } else { // angle sweep
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
      let val = params.minAngle + (pointIdx * (params.maxAngle - params.minAngle)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
      sweepVariableValues.push(val * PI / 180.0); // Convert angle to radians for calculation
    }
    fixedWavelengthNm = params.wavelength;
  }


  for (const currentSweepValue of sweepVariableValues) {
    let wavelength_nm: number;
    let incident_angle_rad: number;

    if (params.sweepType === 'wavelength') {
      wavelength_nm = currentSweepValue;
      incident_angle_rad = fixedAngleRad!;
    } else { // angle sweep
      wavelength_nm = fixedWavelengthNm!;
      incident_angle_rad = currentSweepValue;
    }
    
    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationSucceeded = true;

    // Step 1: Snell's Law (using real parts of n for angles)
    const angles_rad_real: number[] = [incident_angle_rad];
    if (isNaN(incident_angle_rad)) {
        calculationSucceeded = false;
    }

    if(calculationSucceeded) {
        for (let i = 1; i < n_list_complex_full.length; i++) {
            const n_prev_real = n_list_complex_full[i - 1].re;
            const n_curr_real = n_list_complex_full[i].re;
            let angle_i_rad = NaN;

            if (Math.abs(n_curr_real) < FP_TOLERANCE) {
                angle_i_rad = (Math.abs(n_prev_real * Math.sin(angles_rad_real[i - 1])) < FP_TOLERANCE) ? 0 : NaN;
            } else {
                if (isNaN(angles_rad_real[i-1])) { 
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

    const r_coeffs_complex: Complex[] = [];
    const t_coeffs_complex: Complex[] = [];

    if (calculationSucceeded) {
        for (let i = 0; i < n_list_complex_full.length - 1; i++) {
            const n1_complex = n_list_complex_full[i];
            const n2_complex = n_list_complex_full[i + 1];
            const theta1_real = angles_rad_real[i];
            const theta2_real = angles_rad_real[i + 1];
            
            if (isNaN(theta1_real) || isNaN(theta2_real)) {
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
                t_ij = cdiv(num_t, den_r); // Denominator is the same for TM r_ij and t_ij in this form

            } else { // TE / S-polarization
                const term1_r_num = cmul(n1_complex, complex(cos_theta1));
                const term2_r_num = cmul(n2_complex, complex(cos_theta2));
                const num_r = csub(term1_r_num, term2_r_num);
                const den_r = cadd(term1_r_num, term2_r_num);
                r_ij = cdiv(num_r, den_r);
                
                t_ij = cdiv(cmulReal(cmul(n1_complex, complex(cos_theta1)), 2), den_r); 
            }

            if (isNaN(r_ij.re) || isNaN(r_ij.im) || isNaN(t_ij.re) || isNaN(t_ij.im)) {
                calculationSucceeded = false; break;
            }
            r_coeffs_complex.push(r_ij);
            t_coeffs_complex.push(t_ij);
        }
    }
    
    const delta_phases_complex: Complex[] = [C_ZERO]; 
    if(calculationSucceeded) {
        // d_list_nm_full[0] is Inf (incident), d_list_nm_full[d_list_nm_full.length-1] is Inf (substrate)
        // We need phases for internal layers: d_list_nm_full[1] to d_list_nm_full[d_list_nm_full.length-2]
        for (let i = 1; i < d_list_nm_full.length - 1; i++) { 
            const d_nm_layer = d_list_nm_full[i];
            if (d_nm_layer < 0) { calculationSucceeded = false; break; }
            if (Math.abs(d_nm_layer) < FP_TOLERANCE) { 
                delta_phases_complex.push(C_ZERO); 
                continue;
            }

            const N_layer_complex = n_list_complex_full[i];
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
    }
        
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]];
    if(calculationSucceeded) {
        // r_coeffs_complex is for interfaces 0-1, 1-2, ..., N-(N+1)
        // delta_phases_complex needs to align with the layer *before* the interface, or the phase accumulated in the layer associated with r_i
        // Python code: P_i uses delta[i] with r[i]. delta[0] is 0. r[0] is r_01. delta[i] is for layer i (n_list[i]).
        // So delta_phases_complex[0] (for incident medium) is used with r_coeffs_complex[0] (interface 0-1)
        // And delta_phases_complex[k] (for internal layer k) is used with r_coeffs_complex[k] (interface k to k+1)
        for (let i = 0; i < r_coeffs_complex.length; i++) { 
            const r_i = r_coeffs_complex[i];
            // delta_phases_complex[0] is C_ZERO (for incident medium, before first layer).
            // delta_phases_complex[1] is for the first physical layer.
            // The P matrix construction in the reference Python code implies delta[i] is related to the medium N_i.
            // Interface i is between N_i and N_{i+1}. r[i] is r_{i,i+1}.
            // The phase factor exp(-j*delta_i) is associated with layer N_i.
            // So if r_coeffs_complex[i] is for interface i -> i+1,
            // then delta_phases_complex needs to refer to layer i.
            // delta_phases_complex: [delta_incident_medium, delta_layer_1, delta_layer_2, ...]
            // delta_phases_complex[0] is for incident medium, which is 0 if it's semi-infinite.
            // delta_phases_complex[1] is for first internal layer.
            // r_coeffs_complex[0] is r_incident_layer1.
            // r_coeffs_complex[1] is r_layer1_layer2.
            // The Python code's loop `for i in range(len(r))` uses `delta[i]` with `r[i]`.
            // `delta[0]` (Python) is 0. `delta[1]` (Python) is for layer 1 (index 1 in n_list, d_list).
            // Our `delta_phases_complex` has its 0th element as C_ZERO (for incident medium).
            // Its 1st element is for the 1st internal layer.
            // So `delta_phases_complex[i]` is correct if `r_coeffs_complex[i]` corresponds to `r[i]` in python.
            const delta_i_complex = (i < delta_phases_complex.length) ? delta_phases_complex[i] : C_ZERO;

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
      results.push({ 
        xValue: params.sweepType === 'wavelength' ? wavelength_nm : incident_angle_rad * 180 / PI, 
        reflectance: 0, transmittance: 0, absorptance: 0 
      });
      continue; 
    }

    let t_product_complex = C_ONE;
    t_coeffs_complex.forEach(t_val => {
        if(isNaN(t_val.re) || isNaN(t_val.im)) { calculationSucceeded = false; } 
        t_product_complex = cmul(t_product_complex, t_val);
    });
     if (isNaN(t_product_complex.re) || isNaN(t_product_complex.im)) {
        calculationSucceeded = false;
    }

    if (!calculationSucceeded) { 
      results.push({ 
        xValue: params.sweepType === 'wavelength' ? wavelength_nm : incident_angle_rad * 180 / PI, 
        reflectance: 0, transmittance: 0, absorptance: 0 
      });
      continue;
    }
    
    let R_val_calc: number;
    let T_val_calc: number;

    if (cabsSq(M_total[0][0]) < FP_TOLERANCE || isNaN(M_total[0][0].re) || isNaN(M_total[0][0].im) || isNaN(M_total[1][0].re) || isNaN(M_total[1][0].im)) {
        R_val_calc = NaN; 
    } else {
        R_val_calc = cabsSq(cdiv(M_total[1][0], M_total[0][0]));
    }
    R_val_calc = isNaN(R_val_calc) ? 0.0 : R_val_calc;


    const n_inc_val_real = n_list_complex_full[0].re; 
    const n_sub_val_real = n_list_complex_full[n_list_complex_full.length - 1].re; 
    const theta_inc_real = angles_rad_real[0]; // This is incident_angle_rad
    const theta_sub_real = angles_rad_real[angles_rad_real.length - 1];

    let power_transfer_ratio_real = NaN;
    if (!(isNaN(theta_inc_real) || isNaN(theta_sub_real) || 
        isNaN(n_inc_val_real) || isNaN(n_sub_val_real) ||
        Math.abs(n_inc_val_real) < FP_TOLERANCE || Math.abs(Math.cos(theta_inc_real)) < FP_TOLERANCE )) {
        
        const n_inc_eff_real = n_inc_val_real * Math.cos(theta_inc_real); // Real part of n * cos(theta)
        const n_sub_eff_real = n_sub_val_real * Math.cos(theta_sub_real); // Real part of n * cos(theta)

        if (Math.abs(n_inc_eff_real) >= FP_TOLERANCE) {
             power_transfer_ratio_real = n_sub_eff_real / n_inc_eff_real;
        }
    }
    power_transfer_ratio_real = isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0 ? 0 : power_transfer_ratio_real;
        

    if (cabsSq(M_total[0][0]) < FP_TOLERANCE || isNaN(M_total[0][0].re) || isNaN(M_total[0][0].im) || isNaN(t_product_complex.re) || isNaN(t_product_complex.im) ) {
        T_val_calc = NaN;
    } else {
        T_val_calc = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));
    }
    T_val_calc = isNaN(T_val_calc) ? 0.0 : T_val_calc;
    
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
    T_calc = 1.0 - R_calc - A_calc; 
    T_calc = Math.max(0, Math.min(1, T_calc));

    results.push({
      xValue: params.sweepType === 'wavelength' ? wavelength_nm : incident_angle_rad * 180 / PI, // Store angle in degrees
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return { data: results, sweepParameter };
}
