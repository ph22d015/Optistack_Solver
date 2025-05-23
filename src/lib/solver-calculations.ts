
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
  const sinTheta0 = N0_complex.re * Math.sin(angleRad); // Snell's law for incident angle in N0
                                                       // This is actually n0 * sin(theta_0_in_N0) = N_effective_sin_theta_for_all_layers
                                                       // Assuming N0 is real for this definition of sinTheta0.
                                                       // More general would be based on k_parallel conservation.
                                                       // For simplicity here, assuming incident medium's n is real for angle definition.
                                                       // If N0 is complex, angle of incidence definition gets tricky.
                                                       // Typically, angle is defined in a real medium *before* hitting the first complex medium.
                                                       // Here, we take angleDeg as angle in the incidentMedium.
  
  // Let's calculate sin_theta_0_effective, which is N0_complex.re * sin(angleRad) if N0_complex.k == 0
  // If N0_complex.k != 0, the concept of plane wave angle of incidence becomes more complex.
  // For now, we'll use N0_complex.re * sin(angleRad) as an effective parameter for k_parallel.
  // This implies the angle is "as if" defined in a real medium with index N0_complex.re.
  const n0_real_part_for_angle = N0_complex.re; // Using real part of incident medium for initial Snell's law
  const k_parallel_normalized_by_k0 = cmulReal(N0_complex, Math.sin(angleRad)); // This is k_x / (omega/c) for incident wave.

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) continue; 

    // Calculate cosTheta0 based on N0_complex and k_parallel_normalized_by_k0
    // (N0_complex * cosTheta_N0)^2 = N0_complex^2 - (k_parallel_normalized_by_k0)^2
    // Note: k_parallel_normalized_by_k0 from above is just N0_complex * sin(angleRad_in_N0)
    // So, (N0_complex * cosTheta_N0)^2 = N0_complex^2 - (N0_complex * sin(angleRad_in_N0))^2
    //                                 = N0_complex^2 * (1 - sin(angleRad_in_N0)^2)
    //                                 = N0_complex^2 * cos(angleRad_in_N0)^2
    // So, N0_complex * cosTheta_N0 = N0_complex * cos(angleRad_in_N0)
    const cosTheta_N0 = Math.cos(angleRad); // Cosine of the angle in the incident medium
    const N0_cosTheta_N0 = cmulReal(N0_complex, cosTheta_N0);

    let eta0_medium: Complex; 
    if (polarization === 'TE') {
      eta0_medium = N0_cosTheta_N0;
    } else { // TM
      if (cabsSq(N0_cosTheta_N0) < 1e-18 || cabsSq(N0_complex) < 1e-18) {
         eta0_medium = complex(NaN, NaN); // Avoid division by zero or by near-zero N0_complex
      } else {
         eta0_medium = cdiv(cmul(N0_complex, N0_complex), N0_cosTheta_N0); 
      }
    }
    if (isNaN(eta0_medium.re)) { // If eta0 is NaN (e.g., grazing incidence for TM with N0_cos_theta_N0 ~ 0)
        results.push({ wavelength: wavelength_nm, reflectance: 1, transmittance: 0, absorptance: 0 });
        continue;
    }


    // For substrate: Ns_cosTheta_Ns = sqrt(NS_complex^2 - (N0_complex.re * sin(angleRad))^2)
    // This N0_complex.re * sin(angleRad) is effectively k_parallel / k_vacuum
    const k_parallel_div_k_vac_sq = n0_real_part_for_angle * n0_real_part_for_angle * Math.sin(angleRad) * Math.sin(angleRad);
    let NS_cosTheta_NS = csqrt(csub(cmul(NS_complex,NS_complex), complex(k_parallel_div_k_vac_sq)));
    if (NS_cosTheta_NS.im < -1e-9) NS_cosTheta_NS = cmulReal(NS_cosTheta_NS, -1);
    if (Math.abs(NS_cosTheta_NS.im) < 1e-9 && NS_cosTheta_NS.re < -1e-9) NS_cosTheta_NS = cmulReal(NS_cosTheta_NS, -1);


    let etaS_medium: Complex;
    if (polarization === 'TE') {
      etaS_medium = NS_cosTheta_NS;
    } else { // TM
      if (cabsSq(NS_cosTheta_NS) < 1e-18 || cabsSq(NS_complex) < 1e-18) {
        etaS_medium = complex(NaN, NaN); // Avoid division by zero or by near-zero NS_complex
      } else {
        etaS_medium = cdiv(cmul(NS_complex, NS_complex), NS_cosTheta_NS);
      }
    }
     if (isNaN(etaS_medium.re)) { // If etaS is NaN (e.g. critical angle into substrate)
        // This often means total internal reflection if substrate is lossless, or high absorption
        // For simplicity, let's assume high R, low T. Exact behavior depends on M_total.
        // The matrix calculation below will handle it.
    }


    let M_total: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];
    let calculationValid = true;

    for (let l = 0; l < numLayers; l++) {
      const n_l_raw = layerRefractiveIndices[l];
      const n_l_complex = complex(n_l_raw.n, n_l_raw.k < 0 ? 0 : n_l_raw.k);
      const d_l_nm = thicknesses_nm[l];

      // Nl_cosTheta_Nl = sqrt(n_l_complex^2 - (N0_complex.re * sin(angleRad))^2)
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

      if (cabsSq(eta_l) < 1e-18 && cabsSq(sin_delta_l) > 1e-18 && Math.abs(cos_delta_l.re) < 0.999 ) { // eta_l is zero, but sin_delta_l is not, M01 will be Inf
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

    if (calculationValid && !isNaN(M_total[0][0].re) && !isNaN(eta0_medium.re) && !isNaN(etaS_medium.re)) {
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
            R_calc = cabsSq(r_complex);

            const t_complex = cdiv(cmulReal(eta0_medium, 2), den_rt);
            
            // Power transmittance: Re(eta_s) / Re(eta_0) * |t|^2
            // Ensure Re(eta0_medium) is not zero before division
            if (Math.abs(eta0_medium.re) > 1e-9) {
                 T_calc = (etaS_medium.re / eta0_medium.re) * cabsSq(t_complex);
            } else { // Incident medium is highly absorbing or evanescent conditions, no power transmitted far-field
                 T_calc = 0;
            }

        } else { 
            R_calc = 1; 
            T_calc = 0;
        }
    } else if (!calculationValid) { // If calculation became invalid mid-stack
        R_calc = NaN; // Indicate error, will be clamped later
        T_calc = NaN;
    }


    R_calc = (isNaN(R_calc) || R_calc < 0) ? 0 : (R_calc > 1 ? 1 : R_calc);
    T_calc = (isNaN(T_calc) || T_calc < 0) ? 0 : (T_calc > 1 ? 1 : T_calc);

    if (R_calc + T_calc > 1.000001) { // Using a slightly larger tolerance for sum
        T_calc = 1.0 - R_calc;
        T_calc = Math.max(0, T_calc); 
    }
    
    A_calc = 1.0 - R_calc - T_calc;
    A_calc = Math.max(0, Math.min(1, A_calc)); // Final clamp for A


    results.push({
      wavelength: wavelength_nm,
      reflectance: R_calc,
      transmittance: T_calc,
      absorptance: A_calc,
    });
  }
  return results;
}
