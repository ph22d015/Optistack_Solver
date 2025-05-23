
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
const FP_TOLERANCE = 1e-9; // Floating point tolerance (slightly increased for some comparisons)

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
    Infinity, // Incident medium thickness (effectively)
    ...internal_layer_thicknesses_nm,
    Infinity  // Substrate medium thickness (effectively)
  ];

  const polarization = params.polarization;

  // Determine loop parameters based on sweepType
  let sweepVariableValues: number[] = [];
  let fixedAngleRad: number | undefined = undefined;
  let fixedWavelengthNm: number | undefined = undefined;
  let currentXValueForPoint: number;


  if (params.sweepType === 'wavelength') {
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
      let val = params.minWavelength + (pointIdx * (params.maxWavelength - params.minWavelength)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
      if (val <= FP_TOLERANCE) val = FP_TOLERANCE; // Avoid zero wavelength
      sweepVariableValues.push(val);
    }
    fixedAngleRad = (params.angleOfIncidence ?? 0) * PI / 180.0;
  } else { // angle sweep
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
      let val = params.minAngle + (pointIdx * (params.maxAngle - params.minAngle)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
       // Angles are in degrees from form, convert to radians for calculation
      sweepVariableValues.push(val * PI / 180.0);
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
      incident_angle_rad = currentSweepValue; // This is already in radians
      currentXValueForPoint = incident_angle_rad * 180 / PI; // Store angle in degrees for xValue
    }
    
    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationSucceeded = true;
    let tir_occurred_this_point = false; // Flag for TIR

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

            if (Math.abs(n_curr_real) < FP_TOLERANCE) { // Handle n_curr_real being zero
                angle_i_rad = (Math.abs(n_prev_real * Math.sin(angles_rad_real[i - 1])) < FP_TOLERANCE) ? 0 : NaN;
            } else {
                if (isNaN(angles_rad_real[i-1])) { 
                    angle_i_rad = NaN;
                } else {
                    const sin_theta_prev = Math.sin(angles_rad_real[i - 1]);
                    const arg_asin = (n_prev_real / n_curr_real) * sin_theta_prev;

                    if (isNaN(arg_asin)) { // Should not happen if n_curr_real is not zero and angle_prev is not NaN
                        angle_i_rad = NaN;
                    } else if (Math.abs(arg_asin) > 1.0 + FP_TOLERANCE) { // TIR condition
                        tir_occurred_this_point = true;
                        angle_i_rad = NaN; 
                    } else {
                        angle_i_rad = Math.asin(Math.max(-1.0, Math.min(1.0, arg_asin)));
                    }
                }
            }
            // If angle becomes NaN for any internal layer or into substrate, flag calculation failure
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
            reflectance: tir_occurred_this_point ? 1.0 : 0.0, // If TIR, R=1, else general failure R=0
            transmittance: 0.0, 
            absorptance: 0.0 // If R=1, T=0, then A must be 0 for TIR at non-absorbing interface
        });
        continue; 
    }

    // Step 2: Fresnel Coefficients
    const r_coeffs_complex: Complex[] = [];
    const t_coeffs_complex: Complex[] = []; // Product of these t_ij is used later

    for (let i = 0; i < n_list_complex_full.length - 1; i++) {
        const n1_complex = n_list_complex_full[i];
        const n2_complex = n_list_complex_full[i + 1];
        const theta1_real = angles_rad_real[i];
        const theta2_real = angles_rad_real[i + 1]; // This could be NaN if TIR happened earlier
        
        // If theta2_real is NaN from a TIR condition, this block will propagate NaN
        // The `!calculationSucceeded` check above should catch this.
        // However, we ensure theta1_real is valid before proceeding.
        if (isNaN(theta1_real) || (i < n_list_complex_full.length - 2 && isNaN(theta2_real))) { // if theta2 is NaN for non-substrate interface
            calculationSucceeded = false; break;
        }
        
        const cos_theta1 = Math.cos(theta1_real);
        // If theta2_real is NaN, cos_theta2 will be NaN.
        const cos_theta2 = isNaN(theta2_real) ? NaN : Math.cos(theta2_real);
        
        let r_ij: Complex, t_ij: Complex;

        if (polarization === 'TM') { // P-polarization
            const n1_cos_t2 = cmul(n1_complex, complex(cos_theta2));
            const n2_cos_t1 = cmul(n2_complex, complex(cos_theta1));
            const num_r = csub(n2_cos_t1, n1_cos_t2); // n2*cos(t1) - n1*cos(t2)
            const den_r = cadd(n2_cos_t1, n1_cos_t2); // n2*cos(t1) + n1*cos(t2)
            r_ij = cdiv(num_r, den_r);

            // t_ij = (2*n1*cos(t1)) / (n2*cos(t1) + n1*cos(t2))
            const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
            t_ij = cdiv(num_t, den_r);

        } else { // TE / S-polarization
            const n1_cos_t1 = cmul(n1_complex, complex(cos_theta1));
            const n2_cos_t2 = cmul(n2_complex, complex(cos_theta2));
            const num_r = csub(n1_cos_t1, n2_cos_t2); // n1*cos(t1) - n2*cos(t2)
            const den_r = cadd(n1_cos_t1, n2_cos_t2); // n1*cos(t1) + n2*cos(t2)
            r_ij = cdiv(num_r, den_r);
            
            // t_ij = (2*n1*cos(t1)) / (n1*cos(t1) + n2*cos(t2))
            t_ij = cdiv(cmulReal(cmul(n1_complex, complex(cos_theta1)), 2), den_r); 
        }

        if (isNaN(r_ij.re) || isNaN(r_ij.im) || isNaN(t_ij.re) || isNaN(t_ij.im)) {
            calculationSucceeded = false; break;
        }
        r_coeffs_complex.push(r_ij);
        t_coeffs_complex.push(t_ij);
    }
    
    if (!calculationSucceeded) { // Re-check after Fresnel coeffs
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0,
            transmittance: 0.0, 
            absorptance: 0.0
        });
        continue;
    }

    // Step 3: Phase factors
    const delta_phases_complex: Complex[] = [C_ZERO]; 
    for (let i = 1; i < d_list_nm_full.length - 1; i++) { 
        const d_nm_layer = d_list_nm_full[i];
        if (d_nm_layer < 0) { calculationSucceeded = false; break; }
        if (Math.abs(d_nm_layer) < FP_TOLERANCE && d_nm_layer !== 0) { // Effectively zero thickness
            delta_phases_complex.push(C_ZERO); 
            continue;
        }
        if (d_nm_layer === 0) { // Explicitly zero thickness
             delta_phases_complex.push(C_ZERO); 
            continue;
        }


        const N_layer_complex = n_list_complex_full[i];
        const theta_layer_real = angles_rad_real[i]; // This could be NaN
        if (isNaN(theta_layer_real)) { calculationSucceeded = false; break; }
        
        const cos_theta_layer = Math.cos(theta_layer_real);
        // delta_i = (2 * PI * N_layer * cos(theta_layer) * d_layer) / lambda
        const term_N_cos_d = cmulReal(cmul(N_layer_complex, complex(cos_theta_layer)), d_nm_layer);
        const num = cmulReal(term_N_cos_d, 2 * PI);
        const delta_i = cdiv(num, complex(wavelength_nm));
        
        if (isNaN(delta_i.re) || isNaN(delta_i.im)) { calculationSucceeded = false; break; }
        delta_phases_complex.push(delta_i);
    }
        
    if (!calculationSucceeded) { // Re-check after phase factors
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0,
            transmittance: 0.0, 
            absorptance: 0.0
        });
        continue;
    }

    // Step 4: Transfer Matrix Assembly (as per Python reference)
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]];
    for (let i = 0; i < r_coeffs_complex.length; i++) { 
        const r_i = r_coeffs_complex[i];
        const delta_i_complex = (i < delta_phases_complex.length) ? delta_phases_complex[i] : C_ZERO; // delta_phases_complex[0] is for incident medium (0 phase)

        if (isNaN(r_i.re) || isNaN(r_i.im) || isNaN(delta_i_complex.re) || isNaN(delta_i_complex.im)) {
            calculationSucceeded = false; break;
        }

        const exp_neg_i_delta = cexp(cmul(C_I_NEG, delta_i_complex));
        const exp_pos_i_delta = cexp(cmul(C_I, delta_i_complex));

        // P_matrix for interface i, considering phase accumulated in layer i
        const P_matrix: Matrix2x2C = [
          [exp_neg_i_delta, cmul(r_i, exp_neg_i_delta)],
          [cmul(r_i, exp_pos_i_delta), exp_pos_i_delta]
        ];
        M_total = mmul2x2c(M_total, P_matrix);
        if (isNaN(M_total[0][0].re) || isNaN(M_total[0][0].im)) { calculationSucceeded = false; break; }
    }

    if (!calculationSucceeded) { // Final check before RTA
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0,
            transmittance: 0.0, 
            absorptance: 0.0
        });
        continue;
    }
    
    // Step 5: R, T, A from final M_total
    const t_product_complex = t_coeffs_complex.reduce((acc, val) => cmul(acc, val), C_ONE);
    if (isNaN(t_product_complex.re) || isNaN(t_product_complex.im)) { // Should not happen if previous checks passed
        results.push({ xValue: currentXValueForPoint, reflectance: 0, transmittance: 0, absorptance: 0 });
        continue;
    }

    const M00_is_zero = cabsSq(M_total[0][0]) < FP_TOLERANCE * FP_TOLERANCE; // Check magnitude squared

    let R_val_calc_raw: number;
    if (M00_is_zero || isNaN(M_total[1][0].re) || isNaN(M_total[0][0].re)) {
        R_val_calc_raw = NaN; // Or some indicator of failure, e.g. if M00 is 0, R might be 1.
    } else {
        R_val_calc_raw = cabsSq(cdiv(M_total[1][0], M_total[0][0]));
    }
    
    // Calculate power transfer ratio for T
    const n_inc_val_real = n_list_complex_full[0].re; 
    const n_sub_val_real = n_list_complex_full[n_list_complex_full.length - 1].re; 
    const theta_inc_real = angles_rad_real[0];
    const theta_sub_real = angles_rad_real[angles_rad_real.length - 1]; // This could be NaN if TIR

    let power_transfer_ratio_real = NaN;
    if (!(isNaN(theta_inc_real) || isNaN(theta_sub_real) || // If theta_sub_real is NaN (from TIR), ratio is NaN
        isNaN(n_inc_val_real) || isNaN(n_sub_val_real) ||
        Math.abs(n_inc_val_real) < FP_TOLERANCE || Math.abs(Math.cos(theta_inc_real)) < FP_TOLERANCE )) {
        
        const n_inc_eff_real = n_inc_val_real * Math.cos(theta_inc_real);
        const n_sub_eff_real = n_sub_val_real * Math.cos(theta_sub_real);

        if (Math.abs(n_inc_eff_real) >= FP_TOLERANCE) {
             power_transfer_ratio_real = n_sub_eff_real / n_inc_eff_real;
        }
    }
    // If TIR, theta_sub_real is NaN, so power_transfer_ratio_real is NaN. Transmittance should be 0.
    power_transfer_ratio_real = (isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0) ? 0 : power_transfer_ratio_real;
        
    let T_val_calc_raw: number;
    if (M00_is_zero || isNaN(t_product_complex.re) || isNaN(M_total[0][0].re)) {
        T_val_calc_raw = NaN;
    } else {
        T_val_calc_raw = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));
    }

    // Final R, T, A assignment with clamping and energy conservation
    R_calc = isNaN(R_val_calc_raw) ? 0.0 : Math.max(0, Math.min(1, R_val_calc_raw));
    T_calc = isNaN(T_val_calc_raw) ? 0.0 : Math.max(0, Math.min(1, T_val_calc_raw));
    
    // If TIR was flagged and led to NaNs that were zeroed out, R_calc might be 0 here.
    // Override if tir_occurred_this_point is true.
    if (tir_occurred_this_point) {
        R_calc = 1.0;
        T_calc = 0.0;
        A_calc = 0.0;
    } else {
        // Standard clamping for non-TIR cases or if TMM handled TIR correctly to give R near 1
        if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
            if (R_calc >= 1.0 - FP_TOLERANCE && R_calc <= 1.0 + FP_TOLERANCE) { // R is already ~1
                T_calc = 0.0;
                R_calc = 1.0; // Ensure R is exactly 1
            } else {
                // If R + T > 1 but R is not ~1, scale T down.
                T_calc = Math.max(0, 1.0 - R_calc);
            }
        }
        // Ensure R and T are clamped again after adjustments
        R_calc = Math.max(0, Math.min(1, R_calc));
        T_calc = Math.max(0, Math.min(1, T_calc));

        A_calc = 1.0 - R_calc - T_calc;
        A_calc = Math.max(0, Math.min(1, A_calc)); // Clamp A
        
        // Ensure consistency: T = 1 - R - A
        T_calc = 1.0 - R_calc - A_calc;
        T_calc = Math.max(0, Math.min(1, T_calc)); // Final clamp for T
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

