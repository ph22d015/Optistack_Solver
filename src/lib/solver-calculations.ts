
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
    const r = Math.sqrt(a.re * a.re + a.im * a.im);
    if (r === 0) {
        return C_ZERO;
    }
    // Using atan2 for the angle phi and then sqrt(r)*exp(i*phi/2)
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

  if (minWavelength_nm >= maxWavelength_nm || numLayers < 0) {
    return []; 
  }

  const angleRad = angleDeg * PI / 180;
  const sinTheta0 = Math.sin(angleRad);
  const cosTheta0 = Math.cos(angleRad);
  const sinTheta0Sq = sinTheta0 * sinTheta0;

  let eta0: Complex; 
  if (polarization === 'TE') {
    eta0 = cmul(N_AIR, complex(cosTheta0)); 
  } else { // TM
    if (Math.abs(cosTheta0) < 1e-9) { // Grazing incidence for TM
        // For TM at 90 deg, eta0 -> infinity. Results can be ambiguous or all zero.
        // Return empty or specific values if needed. For now, let's fill with zeros.
        for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
            const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
            results.push({ wavelength: wavelength_nm, reflectance: 1, transmittance: 0, absorptance: 0 }); // Total reflection often assumed
        }
        return results;
    }
    eta0 = cdiv(N_AIR, complex(cosTheta0)); 
  }

  const etaS = eta0; // Substrate is also air

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) continue; 

    let M_total: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];
    let calculationValid = true;

    for (let l = 0; l < numLayers; l++) {
      const n_l_raw = layerRefractiveIndices[l];
      const n_l_complex = complex(n_l_raw.n, n_l_raw.k < 0 ? 0 : n_l_raw.k); // Ensure k is non-negative
      const d_l_nm = thicknesses_nm[l];

      const n_l_sq = cmul(n_l_complex, n_l_complex);
      let n_l_cos_theta_l = csqrt(csub(n_l_sq, complex(sinTheta0Sq)));
      
      if (n_l_cos_theta_l.im < -1e-9) { // Ensure decaying wave has positive imaginary part of n_l*cos(theta_l)
         n_l_cos_theta_l = cmulReal(n_l_cos_theta_l, -1);
      }
      // If real part is negative and imaginary part is near zero, flip sign (for propagating wave)
      if (Math.abs(n_l_cos_theta_l.im) < 1e-9 && n_l_cos_theta_l.re < -1e-9){
         n_l_cos_theta_l = cmulReal(n_l_cos_theta_l, -1);
      }


      let eta_l: Complex; 
      if (polarization === 'TE') {
        eta_l = n_l_cos_theta_l;
      } else { // TM
        if (cabsSq(n_l_cos_theta_l) < 1e-18) { 
            calculationValid = false; break;
        }
        eta_l = cdiv(n_l_sq, n_l_cos_theta_l);
      }
      
      if (isNaN(eta_l.re) || isNaN(eta_l.im)) {
         calculationValid = false; break; 
      }

      const phaseFactor = (2 * PI / wavelength_nm) * d_l_nm;
      const delta_l = cmulReal(n_l_cos_theta_l, phaseFactor);

      const cos_delta_l = ccos(delta_l);
      const sin_delta_l = csin(delta_l);

      if (cabsSq(eta_l) < 1e-18 && cabsSq(sin_delta_l) > 1e-18) {
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
    
    let R_calc = 0, T_calc = 0, A_calc = 0;

    if (calculationValid && !isNaN(M_total[0][0].re)) {
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

        if (cabsSq(den_rt) > 1e-18) {
            const r_complex = cdiv(num_r, den_rt);
            R_calc = cabsSq(r_complex);

            const t_complex = cdiv(cmulReal(eta0, 2), den_rt);
            
            if (Math.abs(eta0.re) < 1e-9 && Math.abs(eta0.im) > 1e-9) { // Purely imaginary admittance (e.g. TIR in incident)
                 T_calc = 0; // No propagation
            } else if (Math.abs(eta0.re) < 1e-9 && Math.abs(eta0.im) < 1e-9) { // Zero admittance
                 T_calc = 0;
            } else {
                 T_calc = (etaS.re / eta0.re) * cabsSq(t_complex);
            }
        } else { // Denominator is zero, likely perfect reflection or absorption
            R_calc = 1; // Assume total reflection if denominator is zero, can be refined
            T_calc = 0;
        }
    }

    // Clamp R and T values
    R_calc = (isNaN(R_calc) || R_calc < 0) ? 0 : (R_calc > 1 ? 1 : R_calc);
    T_calc = (isNaN(T_calc) || T_calc < 0) ? 0 : (T_calc > 1 ? 1 : T_calc);

    // Adjust T if R + T > 1 due to precision
    if (R_calc + T_calc > 1.0000001) {
        T_calc = 1.0 - R_calc;
        T_calc = Math.max(0, T_calc); // Ensure T is not negative
    }
    
    A_calc = 1.0 - R_calc - T_calc;
    // Final clamp for A (mainly for non-negativity due to floating point)
    A_calc = Math.max(0, Math.min(1, A_calc));


    results.push({
      wavelength: wavelength_nm,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return results;
}
