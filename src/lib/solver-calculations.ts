
import type { SolverFormValues, OpticalResponsePoint } from '@/types/solver';

// Complex Number Utilities
type Complex = { re: number; im: number };

function complex(re: number, im: number = 0): Complex { return { re, im }; }
const C_ZERO = complex(0, 0);
const C_ONE = complex(1, 0);
const C_I = complex(0, 1);

function cadd(a: Complex, b: Complex): Complex { return complex(a.re + b.re, a.im + b.im); }
function csub(a: Complex, b: Complex): Complex { return complex(a.re - b.re, a.im - b.im); }
function cmul(a: Complex, b: Complex): Complex {
  return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}
function cdiv(a: Complex, b: Complex): Complex {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) return complex(NaN, NaN); // Division by zero yields NaN
  return complex(
    (a.re * b.re + a.im * b.im) / denom,
    (a.im * b.re - a.re * b.im) / denom
  );
}
function cabsSq(a: Complex): number { return a.re * a.re + a.im * a.im; }
function csin(a: Complex): Complex {
  return complex(Math.sin(a.re) * Math.cosh(a.im), Math.cos(a.re) * Math.sinh(a.im));
}
function ccos(a: Complex): Complex {
  return complex(Math.cos(a.re) * Math.cosh(a.im), -Math.sin(a.re) * Math.sinh(a.im));
}
function csqrt(a: Complex): Complex {
    const r_abs = Math.sqrt(a.re * a.re + a.im * a.im);
    if (r_abs === 0) {
        return C_ZERO;
    }
    const phi = Math.atan2(a.im, a.re);
    const sqrt_r_abs = Math.sqrt(r_abs);
    return complex(sqrt_r_abs * Math.cos(phi / 2), sqrt_r_abs * Math.sin(phi / 2));
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

const PI = Math.PI;
const NUM_POINTS = 200;
const FP_TOLERANCE = 1e-9; // Floating point tolerance

export async function calculateOpticalResponse(
  params: SolverFormValues
): Promise<OpticalResponsePoint[]> {
  const results: OpticalResponsePoint[] = [];

  const {
    incidentMediumRefractiveIndex: n0_raw,
    substrateMediumRefractiveIndex: ns_raw,
    numLayers,
    thickness: thicknesses_nm,
    refractiveIndex: layerRefractiveIndices,
    angleOfIncidence: angleDeg,
    polarization,
    minWavelength: minWavelength_nm,
    maxWavelength: maxWavelength_nm,
  } = params;

  if (minWavelength_nm >= maxWavelength_nm) {
    return [];
  }

  // Use n+ik convention (k>0 for absorption)
  const N0_complex = complex(n0_raw.n, n0_raw.k < 0 ? 0 : n0_raw.k);
  const NS_complex = complex(ns_raw.n, ns_raw.k < 0 ? 0 : ns_raw.k);

  const angleRad = angleDeg * PI / 180;
  
  // k_parallel_div_k_vac_sq = (n_incident_real * sin(theta_incident))^2
  // Use real part of N0 for this calculation as angle is defined in incident medium
  const k_parallel_div_k_vac_sq = N0_complex.re * N0_complex.re * Math.sin(angleRad) * Math.sin(angleRad);

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) continue; // Avoid division by zero for wavelength

    // Cosine of angle in incident medium (N0)
    const cosTheta_N0_val = Math.cos(angleRad); // This is real as angleRad is real

    // n_0 * cos(theta_0)
    let N0_cosTheta_N0 = cmulReal(N0_complex, cosTheta_N0_val); 
    // If N0 is complex, N0_cosTheta_N0 becomes complex.
    // However, for optical admittance eta0, if incident medium is lossless, eta0 should be real for normal incidence.
    // For TE mode, eta0 = N0_complex * cos(theta_0_internal_N0), where theta_0_internal_N0 is complex if N0 is complex.
    // A simpler way: eta0 = sqrt(N0^2 - k_parallel_div_k_vac_sq) for TE
    // Let's use n_eff_z = sqrt(n^2 - (n_inc_real sin_theta_inc)^2)
    
    let n0_eff_z = csqrt(csub(cmul(N0_complex,N0_complex), complex(k_parallel_div_k_vac_sq)));
    if (n0_eff_z.im < -FP_TOLERANCE) n0_eff_z = cmulReal(n0_eff_z, -1); // ensure decay in +z or propagating
    if (Math.abs(n0_eff_z.im) < FP_TOLERANCE && n0_eff_z.re < -FP_TOLERANCE) n0_eff_z = cmulReal(n0_eff_z, -1);


    let eta0_medium: Complex;
    if (polarization === 'TE') {
      eta0_medium = n0_eff_z;
    } else { // TM
      if (cabsSq(N0_complex) < FP_TOLERANCE) { // N0 is zero
           eta0_medium = complex(NaN, NaN); // Avoid division by zero
      } else {
           eta0_medium = cdiv(cmul(N0_complex, N0_complex), n0_eff_z);
      }
    }
    
    let ns_eff_z = csqrt(csub(cmul(NS_complex,NS_complex), complex(k_parallel_div_k_vac_sq)));
    if (ns_eff_z.im < -FP_TOLERANCE) ns_eff_z = cmulReal(ns_eff_z, -1);
    if (Math.abs(ns_eff_z.im) < FP_TOLERANCE && ns_eff_z.re < -FP_TOLERANCE) ns_eff_z = cmulReal(ns_eff_z, -1);

    let etaS_medium: Complex;
    if (polarization === 'TE') {
      etaS_medium = ns_eff_z;
    } else { // TM
       if (cabsSq(NS_complex) < FP_TOLERANCE) {
            etaS_medium = complex(NaN,NaN);
       } else {
            etaS_medium = cdiv(cmul(NS_complex, NS_complex), ns_eff_z);
       }
    }

    let M_total: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];
    let calculationValid = true;

    if (isNaN(eta0_medium.re) || isNaN(eta0_medium.im) || isNaN(etaS_medium.re) || isNaN(etaS_medium.im)) {
        calculationValid = false;
    }

    if (calculationValid) {
        for (let l = 0; l < numLayers; l++) {
          const n_l_raw = layerRefractiveIndices[l];
          const n_l_complex = complex(n_l_raw.n, n_l_raw.k < 0 ? 0 : n_l_raw.k);
          const d_l_nm = thicknesses_nm[l];

          let n_l_eff_z = csqrt(csub(cmul(n_l_complex, n_l_complex), complex(k_parallel_div_k_vac_sq)));
          if (n_l_eff_z.im < -FP_TOLERANCE) n_l_eff_z = cmulReal(n_l_eff_z, -1);
          if (Math.abs(n_l_eff_z.im) < FP_TOLERANCE && n_l_eff_z.re < -FP_TOLERANCE) n_l_eff_z = cmulReal(n_l_eff_z, -1);


          let eta_l: Complex;
          if (polarization === 'TE') {
            eta_l = n_l_eff_z;
          } else { // TM
            if (cabsSq(n_l_complex) < FP_TOLERANCE || cabsSq(n_l_eff_z) < FP_TOLERANCE){
                calculationValid = false; break;
            }
            eta_l = cdiv(cmul(n_l_complex, n_l_complex), n_l_eff_z);
          }

          if (isNaN(eta_l.re) || isNaN(eta_l.im)) {
             calculationValid = false; break;
          }

          const phaseFactor_k0_dl = (2 * PI / wavelength_nm) * d_l_nm;
          const delta_l = cmulReal(n_l_eff_z, phaseFactor_k0_dl);

          const cos_delta_l = ccos(delta_l);
          const sin_delta_l = csin(delta_l);
          
          if (cabsSq(eta_l) < FP_TOLERANCE && cabsSq(sin_delta_l) > FP_TOLERANCE) { // Avoid div by zero if eta_l is zero unless sin_delta is also zero
              calculationValid = false; break;
          }
          const M01_term = cmul(C_I, cdiv(sin_delta_l, eta_l)); // i * sin(delta)/eta
          const M10_term = cmul(cmul(C_I, eta_l), sin_delta_l); // i * eta * sin(delta)

          const M_l: Matrix2x2C = [
            [cos_delta_l, M01_term],
            [M10_term, cos_delta_l]
          ];

          if (isNaN(M_l[0][0].re) || isNaN(M_l[0][1].re) || isNaN(M_l[1][0].re) || isNaN(M_l[1][1].re) ) {
               calculationValid = false; break;
          }
          M_total = mmul2x2c(M_total, M_l);
        }
    }

    let R_calc = 0, T_calc = 0, A_calc = 0;

    if (!calculationValid || isNaN(M_total[0][0].re) || isNaN(M_total[0][0].im) ) {
      // If initial admittances or any layer calculation failed, default to R=0, T=0, A=0 or R=1 if appropriate
      // For simplicity, let's default to R=0, T=0, A=0 if calculation was invalid before matrix math
      // If M_total has NaN, it suggests a math error during matrix multiplication.
    } else {
        const M11 = M_total[0][0];
        const M12 = M_total[0][1];
        const M21 = M_total[1][0];
        const M22 = M_total[1][1];

        // num_r = eta0*M11 + eta0*etaS*M12 - M21 - etaS*M22
        // den_rt = eta0*M11 + eta0*etaS*M12 + M21 + etaS*M22
        const term_eta0_M11 = cmul(eta0_medium, M11);
        const term_eta0_etaS_M12 = cmul(cmul(eta0_medium, etaS_medium), M12);
        const term_M21 = M21;
        const term_etaS_M22 = cmul(etaS_medium, M22);

        const num_r_part1 = cadd(term_eta0_M11, term_eta0_etaS_M12);
        const num_r_part2 = cadd(term_M21, term_etaS_M22);

        const num_r_complex = csub(num_r_part1, num_r_part2);
        const den_rt_complex = cadd(num_r_part1, num_r_part2);

        if (cabsSq(den_rt_complex) > FP_TOLERANCE) {
            const r_complex = cdiv(num_r_complex, den_rt_complex);
            let R_physical = cabsSq(r_complex);
            if (isNaN(R_physical)) R_physical = 0; // Safety for NaN from r_complex if den_rt was tiny but non-zero causing overflow

            const t_field_complex = cdiv(cmulReal(eta0_medium, 2), den_rt_complex);
            let T_physical_field_sq = cabsSq(t_field_complex);
            if (isNaN(T_physical_field_sq)) T_physical_field_sq = 0;

            R_calc = R_physical;

            let T_power_transfer_ratio = 0.0;
            // Condition: incident medium must be able to carry power (Re(eta0)>0)
            // and substrate medium must be able to accept power into far-field (Re(etaS)>0)
            if (eta0_medium.re > FP_TOLERANCE && etaS_medium.re > FP_TOLERANCE) {
                T_power_transfer_ratio = etaS_medium.re / eta0_medium.re;
            }
            
            T_calc = T_power_transfer_ratio * T_physical_field_sq;
            if (isNaN(T_calc)) T_calc = 0;

            // Normalize R and T to ensure energy conservation (R+T+A=1, A>=0)
            // Ensure R and T are individually non-negative
            if (R_calc < 0) R_calc = 0;
            if (T_calc < 0) T_calc = 0;

            // If R > 1 (allowing for small tolerance), clamp R=1 and T=0 (implies A=0)
            if (R_calc > 1.0 + FP_TOLERANCE) {
                R_calc = 1.0;
                T_calc = 0.0; // If R is 1, T must be 0 for A>=0
            }
            // If T > 1 (allowing for small tolerance) after R might have been clamped
            // (and R <= 1 here), clamp T=1 and adjust R.
            else if (T_calc > 1.0 + FP_TOLERANCE) {
                T_calc = 1.0;
                R_calc = 0.0; // If T is 1, R must be 0 for A>=0
            }
            // If R+T > 1 (allowing for small tolerance), but R and T individually <=1
            // This means calculated A would be negative. Force A=0 by scaling R and T.
            else if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
                const sum_RT = R_calc + T_calc;
                R_calc = R_calc / sum_RT;
                T_calc = T_calc / sum_RT; // Now R_calc + T_calc = 1
            }
            // At this point, R_calc and T_calc should be <=1 and their sum <=1.

            A_calc = 1.0 - R_calc - T_calc;

            // Final check and clamp due to potential floating point dust.
            R_calc = Math.max(0, Math.min(1, R_calc));
            T_calc = Math.max(0, Math.min(1, T_calc));
            A_calc = Math.max(0, Math.min(1, A_calc));
            
            // One last adjustment for A if sum is slightly off 1 after clamping R, T
             if (Math.abs(1.0 - (R_calc + T_calc + A_calc)) > FP_TOLERANCE && (R_calc + T_calc <= 1.0) ) {
                 A_calc = 1.0 - R_calc - T_calc;
             }


        } else {
            // Denominator den_rt_complex is zero (or very close to it)
            // This typically implies perfect reflection (R=1) for passive systems.
            R_calc = 1;
            T_calc = 0;
            A_calc = 0;
        }
    }

    results.push({
      wavelength: wavelength_nm,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return results;
}

