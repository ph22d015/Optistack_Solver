
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
  if (denom === 0) return complex(NaN, NaN); // Avoid division by zero
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
    // Standard principal square root: sqrt(r) * exp(i*phi/2) where phi = atan2(im, re)
    // This means the argument of the result is in (-pi/2, pi/2].
    // For a complex number z = x + iy, sqrt(z) = sqrt((r+x)/2) + i * sgn(y) * sqrt((r-x)/2)
    // where r = |z|. sgn(y) is 1 if y >= 0, -1 if y < 0. If y=0, sgn(y)=1 if x>=0.
    const r = Math.sqrt(a.re * a.re + a.im * a.im);
    let res_re: number;
    let res_im: number;

    if (r === 0) {
        return C_ZERO;
    }

    if (a.re >= 0) {
        res_re = Math.sqrt((r + a.re) / 2);
        res_im = a.im / (2 * res_re); // More stable than using sgn(y) * sqrt((r-x)/2) if res_re is not 0
        if (res_re === 0) { // when a.re is 0 and a.im is not.
          res_im = Math.sqrt(r/2) * (a.im >=0 ? 1: -1)
        }
    } else { // a.re < 0
        res_im = Math.sqrt((r - a.re) / 2) * (a.im >= 0 ? 1 : -1);
        res_re = a.im / (2 * res_im);
        if (res_im === 0) { // when a.im is 0 and a.re < 0
          res_re = 0; // sqrt of negative real is purely imaginary. This formula gives NaN for res_re.
                      // e.g. sqrt(-4) = 2i. r=4, a.re=-4. res_im = sqrt((4 - (-4))/2) * (0 >= 0 ? 1: -1) = sqrt(4) = 2. res_re should be 0.
        }
    }
    // Handle cases where a.re is near zero or a.im is near zero to avoid division by zero in the stable formulas if res_re or res_im is 0.
    if (Math.abs(a.im) < 1e-12 && a.re < 0) { // Purely negative real
        res_re = 0;
        res_im = Math.sqrt(-a.re);
    } else if (Math.abs(a.re) < 1e-12 && Math.abs(a.im) < 1e-12) { // Zero
        res_re = 0;
        res_im = 0;
    } else if (Math.abs(2 * res_re) < 1e-12 && a.re >= 0 && r !== 0) { // if res_re from sqrt((r+a.re)/2) is 0 for a.re>=0
       // this happens if a.re = 0, a.im != 0.
       res_re = 0; // sqrt(iy) = sqrt(y/2) + i*sqrt(y/2) for y > 0.
       // The above formula calculation might yield small non-zero res_re for pure imaginary.
       // Let's re-evaluate with standard formula:
       const ang = Math.atan2(a.im, a.re);
       const mag_sqrt = Math.sqrt(r);
       return complex(mag_sqrt * Math.cos(ang/2), mag_sqrt * Math.sin(ang/2));
    }


    return complex(res_re, res_im);
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

const N_AIR = complex(1, 0); // Refractive index of air

export async function calculateOpticalResponse(
  params: SolverFormValues
): Promise<OpticalResponsePoint[]> {
  const results: OpticalResponsePoint[] = [];

  const {
    numLayers,
    thickness: thicknesses_nm, 
    refractiveIndex: layerRefractiveIndices, 
    angleOfIncidence: angleDeg,
    polarization,
    minWavelength: minWavelength_nm,
    maxWavelength: maxWavelength_nm,
  } = params;

  if (minWavelength_nm >= maxWavelength_nm || numLayers < 0) { // numLayers can be 0 for interface only
    return []; 
  }

  const angleRad = angleDeg * PI / 180;
  const sinTheta0 = Math.sin(angleRad);
  const cosTheta0 = Math.cos(angleRad);
  const sinTheta0Sq = sinTheta0 * sinTheta0;

  let eta0: Complex; // Admittance of incident medium (air)
  if (polarization === 'TE') {
    eta0 = cmul(N_AIR, complex(cosTheta0)); 
  } else { // TM
    if (Math.abs(cosTheta0) < 1e-9) return []; // Avoid division by zero at grazing incidence for TM
    eta0 = cdiv(N_AIR, complex(cosTheta0)); 
  }

  const etaS = eta0; // Substrate is also air

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) continue; // Avoid zero or negative wavelength

    let M_total: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];

    for (let l = 0; l < numLayers; l++) {
      const n_l_raw = layerRefractiveIndices[l];
      const n_l_complex = complex(n_l_raw.n, n_l_raw.k);
      const d_l_nm = thicknesses_nm[l];

      const n_l_sq = cmul(n_l_complex, n_l_complex);
      // n_l_cos_theta_l = sqrt(n_l^2 - n_0^2*sin_theta_0^2), for n_0=1, sqrt(n_l^2 - sin_theta_0^2)
      let n_l_cos_theta_l = csqrt(csub(n_l_sq, complex(sinTheta0Sq)));
      
      // Ensure positive imaginary part for decay in +z, or positive real part for propagation
      if (n_l_cos_theta_l.im < -1e-9 || (Math.abs(n_l_cos_theta_l.im) < 1e-9 && n_l_cos_theta_l.re < -1e-9)) {
         n_l_cos_theta_l = cmulReal(n_l_cos_theta_l, -1);
      }

      let eta_l: Complex; 
      if (polarization === 'TE') {
        eta_l = n_l_cos_theta_l;
      } else { // TM
        if (cabsSq(n_l_cos_theta_l) < 1e-18) { // Avoid division by zero
             M_total = [[complex(NaN),complex(NaN)],[complex(NaN),complex(NaN)]]; break;
        }
        eta_l = cdiv(n_l_sq, n_l_cos_theta_l);
      }
      
      if (isNaN(eta_l.re) || isNaN(eta_l.im)) {
         M_total = [[complex(NaN),complex(NaN)],[complex(NaN),complex(NaN)]]; break; 
      }

      const phaseFactor = (2 * PI / wavelength_nm) * d_l_nm;
      const delta_l = cmulReal(n_l_cos_theta_l, phaseFactor);

      const cos_delta_l = ccos(delta_l);
      const sin_delta_l = csin(delta_l);

      if (cabsSq(eta_l) < 1e-18 && cabsSq(sin_delta_l) > 1e-18) { // Avoid division by zero if eta_l is zero and sin_delta_l is not
          M_total = [[complex(NaN),complex(NaN)],[complex(NaN),complex(NaN)]]; break;
      }
      const term_M01 = cmul(C_I, cdiv(sin_delta_l, eta_l)); // potential NaN if eta_l is 0

      const M_l: Matrix2x2C = [
        [cos_delta_l, term_M01],
        [cmul(cmul(C_I, eta_l), sin_delta_l), cos_delta_l]
      ];
       if (isNaN(M_l[0][1].re) || isNaN(M_l[1][0].re)) {
           M_total = [[complex(NaN),complex(NaN)],[complex(NaN),complex(NaN)]];
           break;
       }

      M_total = mmul2x2c(M_total, M_l);
    }
    
    let R = NaN, T = NaN, A = NaN;

    if (!isNaN(M_total[0][0].re)) {
        const M11 = M_total[0][0];
        const M12 = M_total[0][1];
        const M21 = M_total[1][0];
        const M22 = M_total[1][1];

        const term1_num = cmul(eta0, M11);
        const term2_num = cmul(cmul(eta0, etaS), M12);
        const term3_num = M21;
        const term4_num = cmul(etaS, M22);

        const num_r = csub(cadd(term1_num, term2_num), cadd(term3_num, term4_num));
        const den_rt = cadd(cadd(term1_num, term2_num), cadd(term3_num, term4_num));

        if (cabsSq(den_rt) < 1e-18) { // Denominator is zero
             // All results remain NaN
        } else {
            const r_complex = cdiv(num_r, den_rt);
            R = cabsSq(r_complex);

            const t_complex = cdiv(cmulReal(eta0, 2), den_rt);
            
            // For air/air, Re(etaS)/Re(eta0) = 1.
            // Transmittance is T = Re(eta_s * cos(theta_s)) / Re(eta_0 * cos(theta_0)) * |t_amp|^2
            // Or, in terms of admittances, T = Re(eta_s) / Re(eta_0) * |t_field|^2
            // Since etaS = eta0 for air-air, factor is 1.
            if (Math.abs(eta0.re) < 1e-9 && Math.abs(eta0.im) > 1e-9) { // Purely imaginary admittance (e.g. TIR in incident)
                 T = 0; // No propagation
            } else if (Math.abs(eta0.re) < 1e-9 && Math.abs(eta0.im) < 1e-9) { // Zero admittance
                 T = 0;
            }
            else {
                 T = (etaS.re / eta0.re) * cabsSq(t_complex);
            }
            
            A = 1 - R - T;
        }
    }

    // Clamp values and handle NaN
    R = (isNaN(R) || R < 0 || R > 1) ? (isNaN(R) ? 0 : Math.max(0, Math.min(1,R))) : R;
    T = (isNaN(T) || T < 0 || T > 1) ? (isNaN(T) ? 0 : Math.max(0, Math.min(1,T))) : T;
    A = (isNaN(A) || A < 0 || A > 1) ? (isNaN(A) ? 0 : Math.max(0, Math.min(1,A))) : A;
    // Ensure R+T+A approx 1, if A was from 1-R-T and R,T clamped, re-evaluate A or adjust.
    // For simplicity, ensure A is at least 0.
    if (R + T > 1.00000001) { // If R+T > 1 due to precision, cap T
        T = 1 - R;
        T = Math.max(0, Math.min(1,T));
    }
    A = Math.max(0, 1 - R - T);


    results.push({
      wavelength: wavelength_nm,
      reflectance: R,
      transmittance: T,
      absorptance: A,
    });
  }
  return results;
}

