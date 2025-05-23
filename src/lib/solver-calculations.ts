
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
    // Principal square root: angle in (-pi/2, pi/2] for the result's argument
    // This means re >= 0
    let phi = Math.atan2(a.im, a.re);
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

  const N0_complex = complex(n0_raw.n, n0_raw.k < 0 ? 0 : n0_raw.k);
  const NS_complex = complex(ns_raw.n, ns_raw.k < 0 ? 0 : ns_raw.k);

  const angleRad = angleDeg * PI / 180;
  
  // k_parallel_div_k_vac_sq = (n_incident_real * sin(theta_incident))^2
  // This k_x component is conserved across all interfaces.
  // Use N0_complex.re for Snell's law as angle of incidence is defined in this medium.
  const k_parallel_div_k_vac_sq = N0_complex.re * N0_complex.re * Math.sin(angleRad) * Math.sin(angleRad);

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) continue; 

    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationValid = true;

    // Effective refractive index component normal to surface for incident medium
    let n0_eff_z = csqrt(csub(cmul(N0_complex, N0_complex), complex(k_parallel_div_k_vac_sq)));
    // Convention: For propagating waves, Re(n_eff_z) >= 0. For evanescent waves, Im(n_eff_z) >= 0 (decay in +z).
    if (n0_eff_z.im < -FP_TOLERANCE) n0_eff_z = cmulReal(n0_eff_z, -1); 
    if (Math.abs(n0_eff_z.im) < FP_TOLERANCE && n0_eff_z.re < -FP_TOLERANCE) n0_eff_z = cmulReal(n0_eff_z, -1);

    let eta0_medium: Complex;
    if (polarization === 'TE') {
      eta0_medium = n0_eff_z;
    } else { // TM
      if (cabsSq(N0_complex) < FP_TOLERANCE) { 
           eta0_medium = complex(NaN, NaN); // Avoid division by zero if N0 is effectively zero
      } else {
           eta0_medium = cdiv(cmul(N0_complex, N0_complex), n0_eff_z);
      }
    }
    
    // Effective refractive index component normal to surface for substrate medium
    let ns_eff_z = csqrt(csub(cmul(NS_complex, NS_complex), complex(k_parallel_div_k_vac_sq)));
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

    if (isNaN(eta0_medium.re) || isNaN(eta0_medium.im) || isNaN(etaS_medium.re) || isNaN(etaS_medium.im)) {
        calculationValid = false;
    }
     // Incident wave must be able to carry power for T, A to be meaningful beyond R=1
    if (eta0_medium.re <= FP_TOLERANCE && calculationValid) {
        R_calc = 1; T_calc = 0; A_calc = 0;
        calculationValid = false; // No further calculation needed, it's total reflection or non-propagating incident.
    }


    let M_total: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];

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
            if (cabsSq(n_l_complex) < FP_TOLERANCE || cabsSq(n_l_eff_z) < FP_TOLERANCE){ // Avoid division by zero if n_l_eff_z is zero
                calculationValid = false; break;
            }
            eta_l = cdiv(cmul(n_l_complex, n_l_complex), n_l_eff_z);
          }

          if (isNaN(eta_l.re) || isNaN(eta_l.im)) {
             calculationValid = false; break;
          }

          const phaseFactor_k0_dl = (2 * PI / wavelength_nm) * d_l_nm; // k0 * d_l
          const delta_l = cmulReal(n_l_eff_z, phaseFactor_k0_dl); // n_l_eff_z * k0 * d_l = k_z_l * d_l

          const cos_delta_l = ccos(delta_l);
          const sin_delta_l = csin(delta_l);
          
          // M_l = [[cos(delta_l), i*sin(delta_l)/eta_l], [i*eta_l*sin(delta_l), cos(delta_l)]]
          if (cabsSq(eta_l) < FP_TOLERANCE && cabsSq(sin_delta_l) > FP_TOLERANCE) { 
              calculationValid = false; break;
          }
          const M01_term = cmul(C_I, cdiv(sin_delta_l, eta_l)); 
          const M10_term = cmul(cmul(C_I, eta_l), sin_delta_l); 

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

    if (calculationValid) {
        const M11 = M_total[0][0];
        const M12 = M_total[0][1];
        const M21 = M_total[1][0];
        const M22 = M_total[1][1];

        // Reflection coefficient r = num_r / den_rt
        // Transmission coefficient t = 2*eta0 / den_rt
        // num_r = (eta0*M11 + eta0*etaS*M12) - (M21 + etaS*M22)
        // den_rt = (eta0*M11 + eta0*etaS*M12) + (M21 + etaS*M22)
        const term_eta0_M11 = cmul(eta0_medium, M11);
        const term_eta0_etaS_M12 = cmul(cmul(eta0_medium, etaS_medium), M12);
        const term_M21 = M21;
        const term_etaS_M22 = cmul(etaS_medium, M22);

        const num_r_part1 = cadd(term_eta0_M11, term_eta0_etaS_M12);
        const num_r_part2 = cadd(term_M21, term_etaS_M22);

        const num_r_complex = csub(num_r_part1, num_r_part2);
        const den_rt_complex = cadd(num_r_part1, num_r_part2);

        if (cabsSq(den_rt_complex) > FP_TOLERANCE * FP_TOLERANCE) { // Check against squared tolerance for denominator magnitude
            const r_complex = cdiv(num_r_complex, den_rt_complex);
            let R_raw = cabsSq(r_complex);
            if (isNaN(R_raw)) R_raw = 0; 

            const t_field_complex = cdiv(cmulReal(eta0_medium, 2), den_rt_complex);
            let T_raw_field_sq = cabsSq(t_field_complex);
            if (isNaN(T_raw_field_sq)) T_raw_field_sq = 0;

            let power_transfer_ratio = 0.0;
            // eta0_medium.re should be > FP_TOLERANCE (checked earlier)
            if (etaS_medium.re > FP_TOLERANCE) { // Power can propagate into substrate
                power_transfer_ratio = etaS_medium.re / eta0_medium.re;
            }
            
            let T_raw_power = power_transfer_ratio * T_raw_field_sq;
            if (isNaN(T_raw_power)) T_raw_power = 0;

            // Apply physical constraints R, T in [0,1] and R+T <= 1
            R_calc = Math.max(0.0, Math.min(1.0, R_raw));
            T_calc = Math.max(0.0, Math.min(1.0, T_raw_power));
            
            if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
                 // If R is already 1 (or very close), T must be 0.
                if (R_calc >= 1.0 - FP_TOLERANCE) {
                    R_calc = 1.0;
                    T_calc = 0.0;
                } else {
                    // Otherwise, R < 1 but R+T > 1. Reduce T to make R+T = 1 (so A=0).
                    T_calc = 1.0 - R_calc;
                }
            }
            
            A_calc = 1.0 - R_calc - T_calc;
            // Final clamp for A to handle tiny negative values from precision errors.
            A_calc = Math.max(0.0, Math.min(1.0, A_calc));

        } else { // Denominator is zero (or numerically very close)
            R_calc = 1; // System shows total reflection (e.g. perfect conductor, or resonance)
            T_calc = 0;
            A_calc = 0;
        }
    }
    // If !calculationValid initially (e.g. eta0_medium.re <=0 or invalid eta0/etaS), R,T,A already set.
    // If calculation became invalid during loop, R,T,A remain 0,0,0 which is a safe default.

    results.push({
      wavelength: wavelength_nm,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return results;
}

    