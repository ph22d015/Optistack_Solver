
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
  if (denom === 0) return complex(NaN, NaN);
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
    const r = Math.sqrt(a.re * a.re + a.im * a.im);
    if (r === 0) {
        return C_ZERO;
    }
    const phi = Math.atan2(a.im, a.re);
    const sqrt_r = Math.sqrt(r);
    return complex(sqrt_r * Math.cos(phi / 2), sqrt_r * Math.sin(phi / 2));
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

  const n0_real_part_for_angle = N0_complex.re;
  const k_parallel_div_k_vac_sq = n0_real_part_for_angle * n0_real_part_for_angle * Math.sin(angleRad) * Math.sin(angleRad);

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) continue;

    const cosTheta_N0 = Math.cos(angleRad);
    const N0_cosTheta_N0 = cmulReal(N0_complex, cosTheta_N0);

    let eta0_medium: Complex;
    if (polarization === 'TE') {
      eta0_medium = N0_cosTheta_N0;
    } else { // TM
      if (cabsSq(N0_cosTheta_N0) < 1e-18 || cabsSq(N0_complex) < 1e-18) {
         eta0_medium = complex(NaN, NaN);
      } else {
         eta0_medium = cdiv(cmul(N0_complex, N0_complex), N0_cosTheta_N0);
      }
    }

    let NS_cosTheta_NS = csqrt(csub(cmul(NS_complex,NS_complex), complex(k_parallel_div_k_vac_sq)));
    if (NS_cosTheta_NS.im < -1e-9) NS_cosTheta_NS = cmulReal(NS_cosTheta_NS, -1);
    if (Math.abs(NS_cosTheta_NS.im) < 1e-9 && NS_cosTheta_NS.re < -1e-9) NS_cosTheta_NS = cmulReal(NS_cosTheta_NS, -1);


    let etaS_medium: Complex;
    if (polarization === 'TE') {
      etaS_medium = NS_cosTheta_NS;
    } else { // TM
      if (cabsSq(NS_cosTheta_NS) < 1e-18 || cabsSq(NS_complex) < 1e-18) {
        etaS_medium = complex(NaN, NaN);
      } else {
        etaS_medium = cdiv(cmul(NS_complex, NS_complex), NS_cosTheta_NS);
      }
    }

    let M_total: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];
    let calculationValid = true;

    if (isNaN(eta0_medium.re) || isNaN(etaS_medium.re)) {
        calculationValid = false;
    }


    if (calculationValid) {
        for (let l = 0; l < numLayers; l++) {
          const n_l_raw = layerRefractiveIndices[l];
          const n_l_complex = complex(n_l_raw.n, n_l_raw.k < 0 ? 0 : n_l_raw.k);
          const d_l_nm = thicknesses_nm[l];

          let n_l_cos_theta_l = csqrt(csub(cmul(n_l_complex, n_l_complex), complex(k_parallel_div_k_vac_sq)));

          if (n_l_cos_theta_l.im < -1e-9) n_l_cos_theta_l = cmulReal(n_l_cos_theta_l, -1);
          if (Math.abs(n_l_cos_theta_l.im) < 1e-9 && n_l_cos_theta_l.re < -1e-9) n_l_cos_theta_l = cmulReal(n_l_cos_theta_l, -1);

          let eta_l: Complex;
          if (polarization === 'TE') {
            eta_l = n_l_cos_theta_l;
          } else { // TM
            if (cabsSq(n_l_cos_theta_l) < 1e-18 || cabsSq(n_l_complex) < 1e-18) {
                calculationValid = false; break;
            }
            eta_l = cdiv(cmul(n_l_complex, n_l_complex), n_l_cos_theta_l);
          }

          if (isNaN(eta_l.re) || isNaN(eta_l.im)) {
             calculationValid = false; break;
          }

          const phaseFactor = (2 * PI / wavelength_nm) * d_l_nm;
          const delta_l = cmulReal(n_l_cos_theta_l, phaseFactor);

          const cos_delta_l = ccos(delta_l);
          const sin_delta_l = csin(delta_l);

          if (cabsSq(eta_l) < 1e-18 && cabsSq(sin_delta_l) > 1e-18 && Math.abs(cos_delta_l.re) < 0.999 ) {
              calculationValid = false; break;
          }
          const term_M01 = cmul(C_I, cdiv(sin_delta_l, eta_l));

          const M_l: Matrix2x2C = [
            [cos_delta_l, term_M01],
            [cmul(cmul(C_I, eta_l), sin_delta_l), cos_delta_l]
          ];
           if (isNaN(M_l[0][1].re) || isNaN(M_l[1][0].re)) {
               calculationValid = false; break;
           }

          M_total = mmul2x2c(M_total, M_l);
        }
    }

    let R_calc = 0, T_calc = 0, A_calc = 0;

    if (!calculationValid || isNaN(M_total[0][0].re) /* Implicitly checks eta0/etaS through earlier check */ ) {
      // If calculation was flagged as invalid, results remain 0,0,0 (as initialized)
      // This handles cases like eta0 or etaS being NaN, or matrix elements becoming NaN.
    } else {
        const M11 = M_total[0][0];
        const M12 = M_total[0][1];
        const M21 = M_total[1][0];
        const M22 = M_total[1][1];

        const term1_num = cmul(eta0_medium, M11);
        const term2_num = cmul(cmul(eta0_medium, etaS_medium), M12);
        const term3_num = M21;
        const term4_num = cmul(etaS_medium, M22);

        const num_r = csub(cadd(term1_num, term2_num), cadd(term3_num, term4_num));
        const den_rt = cadd(cadd(term1_num, term2_num), cadd(term3_num, term4_num));

        if (cabsSq(den_rt) > 1e-18) {
            const r_complex = cdiv(num_r, den_rt);
            let R_physical = cabsSq(r_complex);

            const t_complex = cdiv(cmulReal(eta0_medium, 2), den_rt);
            let T_physical = 0;
            if (Math.abs(eta0_medium.re) > 1e-9) { // Ensure Re(eta0_medium) is not zero for power calc
                 T_physical = (etaS_medium.re / eta0_medium.re) * cabsSq(t_complex);
            } else {
                 T_physical = 0; // Incident medium is highly absorbing or evanescent, no far-field power
            }

            // Clamp R and T based on physical calculations
            R_calc = (isNaN(R_physical) || R_physical < 0) ? 0 : (R_physical > 1 ? 1 : R_physical);
            T_calc = (isNaN(T_physical) || T_physical < 0) ? 0 : (T_physical > 1 ? 1 : T_physical);

            // Ensure R + T <= 1 (with tolerance), prioritizing R.
            if (R_calc + T_calc > 1.000001) {
                T_calc = 1.0 - R_calc;
            }
            T_calc = Math.max(0, T_calc); // Ensure T_calc is not negative after adjustment

            A_calc = 1.0 - R_calc - T_calc;
            A_calc = Math.max(0, Math.min(1, A_calc)); // Final clamp for A for any residual floating point dust.

        } else {
            // Denominator is zero - typically means perfect reflection or a resonant singularity.
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
