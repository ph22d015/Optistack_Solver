
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
  const denom_abs_sq = b.re * b.re + b.im * b.im;
  if (denom_abs_sq === 0) return complex(NaN, NaN); // Avoid division by zero
  return complex(
    (a.re * b.re + a.im * b.im) / denom_abs_sq,
    (a.im * b.re - a.re * b.im) / denom_abs_sq
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
  const internal_layer_thicknesses_nm = params.thickness.map(t => (t < 0 ? 0 : t));

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
  let fixedAngleRad_for_wavelength_sweep: number | undefined = undefined;
  let fixedWavelengthNm_for_angle_sweep: number | undefined = undefined;


  if (params.sweepType === 'wavelength') {
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
      let val = params.minWavelength + (pointIdx * (params.maxWavelength - params.minWavelength)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
      if (val <= FP_TOLERANCE) val = FP_TOLERANCE; // Avoid zero or negative wavelength
      sweepVariableValues.push(val);
    }
    fixedAngleRad_for_wavelength_sweep = (params.angleOfIncidence ?? 0) * PI / 180.0;
  } else { // angle sweep
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
      let val = params.minAngle + (pointIdx * (params.maxAngle - params.minAngle)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
      // Angle is swept in degrees, converted to radians for calculation
      sweepVariableValues.push(val * PI / 180.0);
    }
    fixedWavelengthNm_for_angle_sweep = params.wavelength;
    if (fixedWavelengthNm_for_angle_sweep <= FP_TOLERANCE) fixedWavelengthNm_for_angle_sweep = FP_TOLERANCE;
  }


  for (const currentSweepValue of sweepVariableValues) {
    let wavelength_nm: number;
    let incident_angle_rad: number; // Angle of incidence in the incident medium
    let currentXValueForPoint: number; // Value for the x-axis of the plot

    if (params.sweepType === 'wavelength') {
      wavelength_nm = currentSweepValue;
      incident_angle_rad = fixedAngleRad_for_wavelength_sweep!;
      currentXValueForPoint = wavelength_nm;
    } else { // angle sweep
      wavelength_nm = fixedWavelengthNm_for_angle_sweep!;
      incident_angle_rad = currentSweepValue; // This is already in radians
      currentXValueForPoint = incident_angle_rad * 180 / PI; // Store angle in degrees for xValue
    }
    
    let calculationSucceeded = true;
    let tir_occurred_this_point = false; // Flag for Total Internal Reflection

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
                angle_i_rad = NaN; // Propagate NaN
            } else {
                const sin_theta_prev = Math.sin(angles_rad_real[i - 1]);

                if (Math.abs(n_curr_real) < FP_TOLERANCE) { // Avoid division by zero if n_curr_real is effectively zero
                    // If n_curr_real is zero, propagation is ill-defined unless n_prev_real * sin_theta_prev is also zero.
                    angle_i_rad = (Math.abs(n_prev_real * sin_theta_prev) < FP_TOLERANCE) ? 0 : NaN;
                } else {
                    const arg_asin = (n_prev_real / n_curr_real) * sin_theta_prev;
                    if (isNaN(arg_asin)) { // Should not happen if previous checks are fine
                        angle_i_rad = NaN;
                    } else if (Math.abs(arg_asin) > 1.0 + FP_TOLERANCE) { // TIR condition
                        tir_occurred_this_point = true;
                        angle_i_rad = NaN; 
                    } else {
                        // Clamp arg_asin to [-1, 1] to prevent Math.asin from returning NaN for values just outside due to precision
                        angle_i_rad = Math.asin(Math.max(-1.0, Math.min(1.0, arg_asin)));
                    }
                }
            }
            
            if (isNaN(angle_i_rad)) { 
                calculationSucceeded = false; // Mark as failed if any angle is NaN
                // If TIR caused this NaN, tir_occurred_this_point should be true
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
        continue; // Skip to next sweep point
    }

    // Step 2: Fresnel Coefficients
    const r_coeffs_complex: Complex[] = [];
    const t_coeffs_complex: Complex[] = []; 

    for (let i = 0; i < n_list_complex_full.length - 1; i++) {
        const n1_complex = n_list_complex_full[i];
        const n2_complex = n_list_complex_full[i + 1];
        const theta1_real = angles_rad_real[i];
        // theta2_real can be NaN if TIR occurred at this interface or a previous one leading to this.
        const theta2_real = (i + 1 < angles_rad_real.length) ? angles_rad_real[i + 1] : NaN; 
        
        // If theta1 is NaN, something went wrong earlier. If theta2 is NaN for an internal interface, TIR happened.
        if (isNaN(theta1_real) || (i < n_list_complex_full.length - 2 && isNaN(theta2_real))) {
             calculationSucceeded = false; break;
        }
        
        const cos_theta1 = Math.cos(theta1_real);
        // If theta2_real is NaN (e.g. due to TIR), cos_theta2 will be NaN.
        const cos_theta2 = isNaN(theta2_real) ? NaN : Math.cos(theta2_real);
        
        let r_ij: Complex, t_ij: Complex;

        if (polarization === 'TM') { // P-polarization
            const n1_cos_t2 = cmul(n1_complex, complex(cos_theta2)); // cos_theta2 might be NaN
            const n2_cos_t1 = cmul(n2_complex, complex(cos_theta1));
            const den_rt = cadd(n1_cos_t2, n2_cos_t1); 
            r_ij = cdiv(csub(n2_cos_t1, n1_cos_t2), den_rt);
            const num_t = cmulReal(cmul(n1_complex, complex(cos_theta1)), 2);
            t_ij = cdiv(num_t, den_rt);
        } else { // TE / S-polarization
            const n1_cos_t1 = cmul(n1_complex, complex(cos_theta1));
            const n2_cos_t2 = cmul(n2_complex, complex(cos_theta2)); // cos_theta2 might be NaN
            const den_rt = cadd(n1_cos_t1, n2_cos_t2);
            r_ij = cdiv(csub(n1_cos_t1, n2_cos_t2), den_rt);
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
    const delta_phases_complex: Complex[] = [C_ZERO]; // delta[0] is for incident medium (effectively 0 for P matrix construction)
    for (let i = 1; i < d_list_nm_full.length - 1; i++) { // Corresponds to actual internal layers
        const d_nm_layer = d_list_nm_full[i];
        if (d_nm_layer < 0) { calculationSucceeded = false; break; } // Should not happen with validation
        if (Math.abs(d_nm_layer) < FP_TOLERANCE) { // Zero thickness layer
            delta_phases_complex.push(C_ZERO); 
            continue;
        }

        const N_layer_complex = n_list_complex_full[i];
        const theta_layer_real = angles_rad_real[i]; 
        if (isNaN(theta_layer_real)) { calculationSucceeded = false; break; } // Angle in layer is NaN
        
        const cos_theta_layer = Math.cos(theta_layer_real);
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

    // Step 4: Transfer Matrix Assembly
    let M_total: Matrix2x2C = [[...M_IDENTITY[0]], [...M_IDENTITY[1]]];

    // Python code's P matrix uses delta[i] and r[i].
    // r[i] is r_coeffs_complex[i] (Fresnel for interface i -> i+1)
    // delta[i] in Python's loop for M refers to the phase in layer *before* interface i.
    // So, for P_matrix with r_coeffs_complex[k_idx], we need delta_phases_complex[k_idx].
    // delta_phases_complex[0] is for incident medium.
    // delta_phases_complex[1] is for first actual layer.
    // r_coeffs_complex[0] is for interface: incident_medium -> first_layer.
    // r_coeffs_complex[1] is for interface: first_layer -> second_layer.

    for (let k_idx = 0; k_idx < r_coeffs_complex.length; k_idx++) { 
        const r_i = r_coeffs_complex[k_idx]; 
        // Phase factor corresponds to the layer *from which* light is incident onto the interface r_i describes.
        // If r_i is r_01 (incident to layer 1), use delta of incident medium (delta_phases_complex[0]).
        // If r_i is r_12 (layer 1 to layer 2), use delta of layer 1 (delta_phases_complex[1]).
        const delta_i_complex = (k_idx < delta_phases_complex.length) ? delta_phases_complex[k_idx] : C_ZERO;

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

    if (isNaN(t_product_complex.re) || isNaN(t_product_complex.im)) { // Should not happen if previous checks are fine
        results.push({ 
            xValue: currentXValueForPoint, 
            reflectance: tir_occurred_this_point ? 1.0 : 0.0,
            transmittance: 0.0, 
            absorptance: tir_occurred_this_point ? 0.0 : 0.0
        });
        continue;
    }
    
    const M00_abs_sq = cabsSq(M_total[0][0]);
    // More robust check for M00 being effectively zero
    const M00_is_effectively_zero = M00_abs_sq < (FP_TOLERANCE * FP_TOLERANCE * FP_TOLERANCE); // e.g., 1e-27

    let R_val_calc_raw: number;
    if (M00_is_effectively_zero || isNaN(M_total[1][0].re) || isNaN(M_total[0][0].re)) {
        R_val_calc_raw = NaN; 
    } else {
        R_val_calc_raw = cabsSq(cdiv(M_total[1][0], M_total[0][0]));
    }
    
    const n_inc_val_real = n_list_complex_full[0].re; 
    const n_sub_val_real = n_list_complex_full[n_list_complex_full.length - 1].re; 
    const theta_inc_real = angles_rad_real[0]; // This is incident_angle_rad
    const theta_sub_real = angles_rad_real[angles_rad_real.length - 1]; 

    let power_transfer_ratio_real = NaN;
    if (isNaN(theta_inc_real) || isNaN(n_inc_val_real) || Math.abs(n_inc_val_real) < FP_TOLERANCE || Math.abs(Math.cos(theta_inc_real)) < FP_TOLERANCE ) {
        power_transfer_ratio_real = 0.0; // Incident medium cannot carry power
    } else {
        const cos_theta_sub_real = Math.cos(theta_sub_real);
        if (isNaN(theta_sub_real) || isNaN(n_sub_val_real) || Math.abs(n_sub_val_real) < FP_TOLERANCE || cos_theta_sub_real < FP_TOLERANCE) {
            power_transfer_ratio_real = 0.0; // Substrate non-propagating, or grazing angle in substrate
        } else {
            const n_incident_eff_real = n_inc_val_real * Math.cos(theta_inc_real); // Guaranteed > FP_TOLERANCE by above
            const n_substrate_eff_real = n_sub_val_real * cos_theta_sub_real; // Guaranteed > FP_TOLERANCE by above
            power_transfer_ratio_real = n_substrate_eff_real / n_incident_eff_real;
        }
    }
    power_transfer_ratio_real = (isNaN(power_transfer_ratio_real) || power_transfer_ratio_real < 0) ? 0 : power_transfer_ratio_real;
        
    let T_val_calc_raw: number;
    if (M00_is_effectively_zero || isNaN(t_product_complex.re) || isNaN(M_total[0][0].re)) {
        T_val_calc_raw = NaN;
    } else {
        T_val_calc_raw = power_transfer_ratio_real * cabsSq(cdiv(t_product_complex, M_total[0][0]));
    }

    let R_calc: number, T_calc: number, A_calc: number;

    // Initialize R_calc, T_calc based on raw values and TIR detection
    if (tir_occurred_this_point) {
        R_calc = 1.0;
        T_calc = 0.0;
    } else {
        R_calc = isNaN(R_val_calc_raw) ? 0.0 : R_val_calc_raw;
        T_calc = isNaN(T_val_calc_raw) ? 0.0 : T_val_calc_raw;
    }

    // Clamp R and T to [0,1]
    R_calc = Math.max(0, Math.min(1, R_calc));
    T_calc = Math.max(0, Math.min(1, T_calc));

    // Ensure energy conservation: R + T <= 1
    if (R_calc + T_calc > 1.0 + FP_TOLERANCE) { // Add tolerance for sum check
        if (R_calc >= 1.0 - FP_TOLERANCE) { // If R is already essentially 1 or >1
            T_calc = 0.0;
            R_calc = 1.0; // Clamp R to 1 if it's very close or over
        } else { // Otherwise, R < 1 but R+T > 1. Scale T down.
            T_calc = 1.0 - R_calc;
        }
    }
    
    A_calc = 1.0 - R_calc - T_calc;
    A_calc = Math.max(0, Math.min(1, A_calc)); // Clamp A

    // Final consistency for T based on clamped R and A (especially if A was clamped up from negative)
    T_calc = 1.0 - R_calc - A_calc;
    T_calc = Math.max(0, Math.min(1, T_calc)); // Clamp T finally

    // The tir_occurred_this_point condition at the start of this block should handle explicit TIR.
    // This final check ensures that if matrix math somehow resulted in T>0 despite TIR, it's corrected.
    if (tir_occurred_this_point) {
        R_calc = 1.0;
        T_calc = 0.0;
        A_calc = 0.0;
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
