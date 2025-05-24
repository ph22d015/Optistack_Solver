
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
const FP_TOLERANCE = 1e-9; // Floating point tolerance

export async function calculateOpticalResponse(
  params: SolverFormValues
): Promise<{ data: OpticalResponsePoint[], sweepParameter: SweepParameter }> {
  const results: OpticalResponsePoint[] = [];
  const sweepParameter = params.sweepType;

  const n_incident_medium_complex = complex(params.incidentMediumRefractiveIndex.n, params.incidentMediumRefractiveIndex.k);
  const n_substrate_medium_complex = complex(params.substrateMediumRefractiveIndex.n, params.substrateMediumRefractiveIndex.k);

  const internal_layer_refractive_indices_complex = params.refractiveIndex.map(ri => complex(ri.n, ri.k));
  const internal_layer_thicknesses_nm = params.thickness.map(t => (t < 0 ? 0 : t)); // Ensure thickness isn't negative

  const n_list_complex_full: Complex[] = [
    n_incident_medium_complex,
    ...internal_layer_refractive_indices_complex,
    n_substrate_medium_complex
  ];

  const d_list_nm_full: number[] = [
    Infinity, // Incident medium thickness
    ...internal_layer_thicknesses_nm,
    Infinity  // Substrate medium thickness
  ];

  const polarization = params.polarization;

  let sweepVariableValues: number[] = [];
  let fixedAngleRad: number | undefined = undefined;
  let fixedWavelengthNm: number | undefined = undefined;
  let currentXValueForPoint: number;

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
      sweepVariableValues.push(val * PI / 180.0); // Convert to radians
    }
    fixedWavelengthNm = params.wavelength;
    if (fixedWavelengthNm <= FP_TOLERANCE) fixedWavelengthNm = FP_TOLERANCE;
  }


  for (const currentSweepValue of sweepVariableValues) {
    let wavelength_nm: number;
    let incident_angle_rad: number;

    if (params.sweepType === 'wavelength') {
      wavelength_nm = currentSweepValue;
      incident_angle_rad = fixedAngleRad!;
      currentXValueForPoint = wavelength_nm;
    } else { // angle sweep
      wavelength_nm = fixedWavelengthNm!;
      incident_angle_rad = currentSweepValue; // Already in radians
      currentXValueForPoint = incident_angle_rad * 180 / PI; // Store angle in degrees for xValue
    }
    
    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationSucceeded = true;
    let tir_occurred_this_point = false;

    // Step 1: Snell's Law (using real parts of n for angles)
    const angles_rad_real: number[] = [incident_angle_rad];
    if (isNaN(incident_angle_rad)) {
        calculationSucceeded = false;
    }

    if(calculationSucceeded) {
        for (let i = 1; i < n_list_complex_full.length; i++) {
            const n_prev_real = n_list_complex_full[i - 1].re;
            const n_curr_real = n_list_complex_full[i].re;
            let angle_i_rad: number;

            if (isNaN(angles_rad_real[i-1])) { 
                angle_i_rad = NaN;
                calculationSucceeded = false; 
                break;
            }
            const sin_theta_prev = Math.sin(angles_rad_real[i - 1]);

            if (Math.abs(n_curr_real) < FP_TOLERANCE) { 
                angle_i_rad = (Math.abs(n_prev_real * sin_theta_prev) < FP_TOLERANCE) ? 0 : NaN;
            } else {
                const arg_asin = (n_prev_real / n_curr_real) * sin_theta_prev;
                if (isNaN(arg_asin)) {
                    angle_i_rad = NaN;
                } else if (Math.abs(arg_asin) > 1.0 + FP_TOLERANCE) { // TIR condition
                    tir_occurred_this_point = true;
                    angle_i_rad = NaN; 
                } else {
                    angle_i_rad = Math.asin(Math.max(-1.0, Math.min(1.0, arg_asin)));
                }
            }
            
            if (isNaN(angle_i_rad)) { 
                calculationSucceeded = false; 
                break; 
            }
            angles_rad_real.push(angle_i_rad);
        }
    }

    if (!calculationSucceeded) {
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0, 
            transmittance: 0.0, 
            absorptance: tir_occurred_this_point ? 0.0 : 0.0
        });
        continue; 
    }

    // Step 2: Fresnel Coefficients
    const r_coeffs_complex: Complex[] = [];
    const t_coeffs_complex: Complex[] = []; 

    for (let i = 0; i < n_list_complex_full.length - 1; i++) {
        const n1_complex = n_list_complex_full[i];
        const n2_complex = n_list_complex_full[i + 1];
        const theta1_real = angles_rad_real[i];
        const theta2_real = angles_rad_real[i + 1]; 
        
        if (isNaN(theta1_real) || (i < n_list_complex_full.length - 2 && isNaN(theta2_real))) {
            calculationSucceeded = false; break;
        }
        
        const cos_theta1 = Math.cos(theta1_real);
        const cos_theta2 = isNaN(theta2_real) ? NaN : Math.cos(theta2_real);
        
        let r_ij: Complex, t_ij: Complex;

        if (polarization === 'TM') { // P-polarization (Python's 'P')
            // r_ij = (-n1*cos(t2) + n2*cos(t1)) / (n1*cos(t2) + n2*cos(t1))
            // t_ij = (2*n1*cos(t1)) / (n2*cos(t1) + n1*cos(t2))
            const n1_cos_t2 = cmul(n1_complex, complex(cos_theta2));
            const n2_cos_t1 = cmul(n2_complex, complex(cos_theta1));
            const num_r = csub(n2_cos_t1, n1_cos_t2);
            const den_rt = cadd(n1_cos_t2, n2_cos_t1); // Common denominator for r and t for P-pol
            r_ij = cdiv(num_r, den_rt);

            const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
            t_ij = cdiv(num_t, den_rt); // Denominator in Python code is (n2*cos(t1) + n1*cos(t2))
                                        // which is the same as n1_cos_t2 + n2_cos_t1
        } else { // TE / S-polarization (Python's 'S')
            // r_ij = (n1*cos(t1) - n2*cos(t2)) / (n1*cos(t1) + n2*cos(t2))
            // t_ij = (2*n1*cos(t1)) / (n1*cos(t1) + n2*cos(t2))
            const n1_cos_t1 = cmul(n1_complex, complex(cos_theta1));
            const n2_cos_t2 = cmul(n2_complex, complex(cos_theta2));
            const num_r = csub(n1_cos_t1, n2_cos_t2); 
            const den_rt = cadd(n1_cos_t1, n2_cos_t2); // Common denominator for r and t for S-pol
            r_ij = cdiv(num_r, den_rt);
            
            t_ij = cdiv(cmulReal(n1_cos_t1, 2), den_rt); 
        }

        if (isNaN(r_ij.re) || isNaN(r_ij.im) || isNaN(t_ij.re) || isNaN(t_ij.im)) {
            calculationSucceeded = false; break;
        }
        r_coeffs_complex.push(r_ij);
        t_coeffs_complex.push(t_ij);
    }
    
    if (!calculationSucceeded) {
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0,
            transmittance: 0.0, 
            absorptance: tir_occurred_this_point ? 0.0 : 0.0
        });
        continue;
    }

    // Step 3: Phase factors
    const delta_phases_complex: Complex[] = [C_ZERO]; // delta[0] is effectively 0 (for incident medium)
    for (let i = 1; i < d_list_nm_full.length - 1; i++) { // Corresponds to actual layers
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
        
    if (!calculationSucceeded) { 
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0,
            transmittance: 0.0, 
            absorptance: tir_occurred_this_point ? 0.0 : 0.0
        });
        continue;
    }

    // Step 4: Transfer Matrix Assembly (as per Python reference)
    // M_total is initialized for the first interface (0-1).
    // The loop then considers interfaces 1-2, 2-3, ..., up to N-s
    // The P matrix for interface i to i+1 uses delta[i] (phase in layer i) and r[i] (reflection from i to i+1)
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]];

    // Python code's M = M @ P logic iterates over 'r' (Fresnel coefficients between layers)
    // So, r[i] is for interface i -> i+1. delta[i] is for layer i.
    // P_matrix for interface i (between layer i-1 and layer i) uses r_i and delta_i (phase in layer i)
    for (let i = 0; i < r_coeffs_complex.length; i++) { 
        const r_i = r_coeffs_complex[i]; // Reflection from layer i to i+1
        const delta_i_complex = (i < delta_phases_complex.length) ? delta_phases_complex[i] : C_ZERO; // Phase in layer i (delta_phases_complex[0] is for incident)

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
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0,
            transmittance: 0.0, 
            absorptance: tir_occurred_this_point ? 0.0 : 0.0
        });
        continue;
    }
    
    // Step 5: R, T, A from final M_total
    let t_product_complex = C_ONE;
    t_coeffs_complex.forEach(tc => t_product_complex = cmul(t_product_complex, tc));

    if (isNaN(t_product_complex.re) || isNaN(t_product_complex.im)) { // Should not happen
        results.push({ xValue: currentXValueForPoint, reflectance: 0, transmittance: 0, absorptance: 0 });
        continue;
    }

    const M00_is_zero = cabsSq(M_total[0][0]) < FP_TOLERANCE * FP_TOLERANCE;

    let R_val_calc_raw: number;
    if (M00_is_zero || isNaN(M_total[1][0].re) || isNaN(M_total[0][0].re)) {
        R_val_calc_raw = tir_occurred_this_point ? 1.0 : NaN; 
    } else {
        R_val_calc_raw = cabsSq(cdiv(M_total[1][0], M_total[0][0]));
    }
    
    const n_inc_val_real = n_list_complex_full[0].re; 
    const n_sub_val_real = n_list_complex_full[n_list_complex_full.length - 1].re; 
    const theta_inc_real = angles_rad_real[0];
    const theta_sub_real = angles_rad_real[angles_rad_real.length - 1]; 

    let power_transfer_ratio_real = NaN;
    if (!(isNaN(theta_inc_real) || isNaN(n_inc_val_real) || Math.abs(n_inc_val_real) < FP_TOLERANCE || Math.abs(Math.cos(theta_inc_real)) < FP_TOLERANCE )) {
        const n_incident_eff_real = n_inc_val_real * Math.cos(theta_inc_real);

        if (isNaN(theta_sub_real) || isNaN(n_sub_val_real) || Math.abs(n_sub_val_real) < FP_TOLERANCE) {
            power_transfer_ratio_real = 0.0; // TIR or substrate non-propagating
        } else {
            const cos_theta_sub_real = Math.cos(theta_sub_real);
            if (cos_theta_sub_real < FP_TOLERANCE) { // At or very near critical angle for substrate
                power_transfer_ratio_real = 0.0;
            } else {
                const n_substrate_eff_real = n_sub_val_real * cos_theta_sub_real;
                if (Math.abs(n_incident_eff_real) >= FP_TOLERANCE) {
                     power_transfer_ratio_real = n_substrate_eff_real / n_incident_eff_real;
                } else {
                    power_transfer_ratio_real = 0.0; // Incident power is zero
                }
            }
        }
    }
    power_transfer_ratio_real = (isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0) ? 0 : power_transfer_ratio_real;
        
    let T_val_calc_raw: number;
    if (M00_is_zero || isNaN(t_product_complex.re) || isNaN(M_total[0][0].re)) {
        T_val_calc_raw = NaN;
    } else {
        T_val_calc_raw = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));
    }

    R_calc = isNaN(R_val_calc_raw) ? (tir_occurred_this_point ? 1.0 : 0.0) : R_val_calc_raw;
    T_calc = isNaN(T_val_calc_raw) ? 0.0 : T_val_calc_raw;

    // Ensure R and T are within [0,1]
    R_calc = Math.max(0, Math.min(1, R_calc));
    T_calc = Math.max(0, Math.min(1, T_calc));

    if (tir_occurred_this_point) { // Override if TIR was definitively detected
        R_calc = 1.0;
        T_calc = 0.0;
        A_calc = 0.0;
    } else {
        if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
            // If R is already ~1, T should be 0
            if (R_calc >= 1.0 - FP_TOLERANCE) {
                T_calc = 0.0;
                R_calc = 1.0; // Ensure R is exactly 1 if it's already very close
            } else {
                // Otherwise, scale T down to conserve energy
                T_calc = Math.max(0, 1.0 - R_calc);
            }
        }
        // Recalculate T to ensure consistency if A is primarily 1-R-T
        A_calc = 1.0 - R_calc - T_calc;
        A_calc = Math.max(0, Math.min(1, A_calc)); // Clamp A

        // Final adjustment for T based on clamped R and A to ensure R+T+A=1
        T_calc = 1.0 - R_calc - A_calc;
        T_calc = Math.max(0, Math.min(1, T_calc)); // Clamp T finally
    }
    
    results.push({
      xValue: currentXValueForPoint,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return { data: results, sweepParameter };
}

