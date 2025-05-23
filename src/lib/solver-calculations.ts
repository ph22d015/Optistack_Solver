
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

// Algebraic complex square root: sqrt(x + iy)
// Returns principal root: Re(sqrt) >= 0. Im(sqrt) has same sign as y.
function csqrt(a: Complex): Complex {
    const x = a.re;
    const y = a.im;

    if (x === 0 && y === 0) {
        return C_ZERO;
    }

    const r_abs = Math.sqrt(x * x + y * y);
    let s_re: number;
    let s_im: number;

    // Formula: sqrt(z) = sqrt((|z|+x)/2) + i * sgn(y) * sqrt((|z|-x)/2)
    // where sgn(y) is 1 if y>=0, -1 if y<0. For y=0, sgn(0)=0 if x<0 (sqrt(-|x|) = i*sqrt(|x|))
    // or can be taken as 1 if x>=0 (sqrt(x)=sqrt(x))

    s_re = Math.sqrt((r_abs + x) / 2);

    if (y >= 0) {
        s_im = Math.sqrt((r_abs - x) / 2);
    } else {
        s_im = -Math.sqrt((r_abs - x) / 2);
    }
    
    // For the case where x < 0 and y is exactly 0 (e.g. sqrt(-4) = 2i)
    // (r_abs - x)/2 = (-x - x)/2 = -x = |x|
    // (r_abs + x)/2 = (-x + x)/2 = 0
    // If y=0, x<0: s_re = 0. s_im depends on y>=0 convention.
    // If we take sgn(0) for Im(sqrt(z)) to be such that Im(sqrt(z)) >=0 (standard principal root convention for negative reals)
    // Then if y=0, x<0 => sqrt(x) = i * sqrt(-x). My formula above should give s_re = 0, s_im = sqrt(-x).
    if (y === 0 && x < 0) {
      return complex(0, Math.sqrt(-x));
    }
    
    return complex(s_re, s_im);
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

  if (minWavelength_nm <=0 || maxWavelength_nm <=0 || minWavelength_nm >= maxWavelength_nm) {
    // Return empty or NaN results for invalid wavelength range
    for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
        const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
    }
    return results;
  }


  // N = n + ik (k is positive for absorption, as per user input schema for extinction coefficient)
  const N0_complex = complex(n0_raw.n, n0_raw.k);
  const NS_complex = complex(ns_raw.n, ns_raw.k);

  const angleRad = angleDeg * PI / 180;
  
  // k_parallel_div_k_vac_sq = (N0_real * sin(theta0))^2
  // Use N0_complex.re for Snell's law as angle of incidence is defined in this medium.
  // Ensure N0_complex.re is non-negative as n usually is.
  const n0_real_for_snell = Math.max(0, N0_complex.re);
  const k_parallel_div_k_vac_sq = n0_real_for_snell * n0_real_for_snell * Math.sin(angleRad) * Math.sin(angleRad);

  for (let pointIdx = 0; pointIdx < NUM_POINTS; pointIdx++) {
    const wavelength_nm = minWavelength_nm + (pointIdx * (maxWavelength_nm - minWavelength_nm)) / (NUM_POINTS > 1 ? NUM_POINTS - 1 : 1);
    if (wavelength_nm <= 1e-9) { // effectively zero wavelength
        results.push({ wavelength: wavelength_nm, reflectance: NaN, transmittance: NaN, absorptance: NaN });
        continue;
    }

    let R_calc = 0, T_calc = 0, A_calc = 0;
    let calculationValid = true;

    // k_vac = 2 * PI / wavelength_nm (in appropriate units if wavelength_nm is in nm)
    // For n_eff_z: sqrt(N^2 - k_parallel_div_k_vac_sq)
    // N^2 - k_parallel_div_k_vac_sq
    const n0_sq_minus_kpar_sq = csub(cmul(N0_complex, N0_complex), complex(k_parallel_div_k_vac_sq));
    let n0_eff_z = csqrt(n0_sq_minus_kpar_sq); // Im(n_eff_z) >= 0 for passive media by csqrt principal root

    let eta0_medium: Complex;
    if (polarization === 'TE') {
      eta0_medium = n0_eff_z;
    } else { // TM
      if (cabsSq(N0_complex) < FP_TOLERANCE && cabsSq(n0_eff_z) > FP_TOLERANCE ) {
           eta0_medium = complex(NaN, NaN); // Avoid division by N0_complex=0
      } else if (cabsSq(n0_eff_z) < FP_TOLERANCE) { // n0_eff_z is zero
           eta0_medium = complex(NaN, NaN); // Admittance would be infinite or ill-defined
      } else {
           eta0_medium = cdiv(N0_complex, n0_eff_z); // Corrected: N/n_z for Y_TM related to free space admittance N, not N^2/n_z
           // Or if eta is n*Y0, then for TM, Y_TM = N^2 * Y0 / n_z = N^2/n_z if Y0=1
           // Let's stick to common definition: eta_TE = n_z, eta_TM = N^2/n_z (relative to Y_free_space=1)
           eta0_medium = cdiv(cmul(N0_complex,N0_complex), n0_eff_z);
      }
    }
    
    const ns_sq_minus_kpar_sq = csub(cmul(NS_complex, NS_complex), complex(k_parallel_div_k_vac_sq));
    let ns_eff_z = csqrt(ns_sq_minus_kpar_sq);

    let etaS_medium: Complex;
    if (polarization === 'TE') {
      etaS_medium = ns_eff_z;
    } else { // TM
       if (cabsSq(NS_complex) < FP_TOLERANCE && cabsSq(ns_eff_z) > FP_TOLERANCE) {
            etaS_medium = complex(NaN,NaN);
       } else if (cabsSq(ns_eff_z) < FP_TOLERANCE) {
            etaS_medium = complex(NaN,NaN);
       } else {
            etaS_medium = cdiv(cmul(NS_complex,NS_complex), ns_eff_z);
       }
    }

    if (isNaN(eta0_medium.re) || isNaN(eta0_medium.im) || isNaN(etaS_medium.re) || isNaN(etaS_medium.im)) {
        calculationValid = false;
    }
    
    if (calculationValid && eta0_medium.re <= FP_TOLERANCE) {
        R_calc = 1; T_calc = 0; A_calc = 0;
        calculationValid = false; 
    }

    let M_total: Matrix2x2C = [[C_ONE, C_ZERO], [C_ZERO, C_ONE]];

    if (calculationValid) {
        for (let l = 0; l < numLayers; l++) {
          const n_l_raw = layerRefractiveIndices[l];
          const N_l_complex = complex(n_l_raw.n, n_l_raw.k);
          const d_l_nm = thicknesses_nm[l];
          if (d_l_nm < 0) { // Negative thickness is unphysical
            calculationValid = false; break;
          }

          const nl_sq_minus_kpar_sq = csub(cmul(N_l_complex, N_l_complex), complex(k_parallel_div_k_vac_sq));
          let n_l_eff_z = csqrt(nl_sq_minus_kpar_sq);
          
          let eta_l: Complex;
          if (polarization === 'TE') {
            eta_l = n_l_eff_z;
          } else { // TM
            if (cabsSq(N_l_complex) < FP_TOLERANCE && cabsSq(n_l_eff_z) > FP_TOLERANCE){
                eta_l = complex(NaN, NaN);
            } else if (cabsSq(n_l_eff_z) < FP_TOLERANCE) {
                eta_l = complex(NaN, NaN);
            } else {
                eta_l = cdiv(cmul(N_l_complex,N_l_complex), n_l_eff_z);
            }
          }

          if (isNaN(eta_l.re) || isNaN(eta_l.im)) {
             calculationValid = false; break;
          }

          const k0_vacuum_times_dl = (2 * PI / wavelength_nm) * d_l_nm; 
          const delta_l = cmul(n_l_eff_z, complex(k0_vacuum_times_dl)); 

          const cos_delta_l = ccos(delta_l);
          const sin_delta_l = csin(delta_l);
          
          if (cabsSq(eta_l) < FP_TOLERANCE * FP_TOLERANCE && cabsSq(sin_delta_l) > FP_TOLERANCE * FP_TOLERANCE) { 
              calculationValid = false; break;
          }
          
          const M01_val = cabsSq(eta_l) < FP_TOLERANCE ? complex(NaN, NaN) : cdiv(sin_delta_l, eta_l);
          const M01_term = cmul(C_I, M01_val); 
          const M10_term = cmul(cmul(C_I, eta_l), sin_delta_l); 

          const M_l: Matrix2x2C = [
            [cos_delta_l, M01_term],
            [M10_term, cos_delta_l]
          ];

          let hasNaNInMl = false;
          for(let r=0; r<2; ++r) for(let c=0; c<2; ++c) {
              if(isNaN(M_l[r][c].re) || isNaN(M_l[r][c].im)) hasNaNInMl = true;
          }
          if (hasNaNInMl) {
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

        // r = (eta0*M11 + eta0*etaS*M12 - M21 - etaS*M22) / Den
        // Den = (eta0*M11 + eta0*etaS*M12 + M21 + etaS*M22)
        const term1 = cmul(eta0_medium, M11);
        const term2 = cmul(cmul(eta0_medium, etaS_medium), M12);
        const term3 = M21;
        const term4 = cmul(etaS_medium, M22);

        const den_rt_complex = cadd(cadd(term1, term2), cadd(term3, term4));
        const num_r_complex_partA = cadd(term1, term2);
        const num_r_complex_partB = cadd(term3, term4);
        const num_r_complex = csub(num_r_complex_partA, num_r_complex_partB);

        let R_raw = 0, T_raw_power = 0;

        if (cabsSq(den_rt_complex) > FP_TOLERANCE * FP_TOLERANCE * FP_TOLERANCE * FP_TOLERANCE) { // Increase tolerance for denominator check
            const r_complex = cdiv(num_r_complex, den_rt_complex);
            R_raw = cabsSq(r_complex);
            if (isNaN(R_raw)) R_raw = 0; 

            // t_field = 2*eta0 / Den
            const t_field_complex = cdiv(cmulReal(eta0_medium, 2), den_rt_complex);
            let T_raw_field_sq = cabsSq(t_field_complex);
            if (isNaN(T_raw_field_sq)) T_raw_field_sq = 0;

            let power_transfer_ratio = 0.0;
            // This check for eta0_medium.re was done earlier. If it's <= FP_TOLERANCE, calculationValid became false.
            // So here we assume eta0_medium.re > FP_TOLERANCE.
            if (etaS_medium.re > FP_TOLERANCE) { 
                power_transfer_ratio = etaS_medium.re / eta0_medium.re;
            } else { // Substrate cannot accept propagating power (e.g. evanescent, or highly absorbing near interface)
                power_transfer_ratio = 0.0;
            }
            
            T_raw_power = power_transfer_ratio * T_raw_field_sq;
            if (isNaN(T_raw_power)) T_raw_power = 0;

        } else { 
            R_raw = 1; 
            T_raw_power = 0;
        }
        
        R_calc = isNaN(R_raw) ? 0 : Math.max(0.0, Math.min(1.0, R_raw));
        T_calc = isNaN(T_raw_power) ? 0 : Math.max(0.0, Math.min(1.0, T_raw_power));

        if (R_calc + T_calc > 1.0 + FP_TOLERANCE) {
            if (R_calc >= 1.0 - FP_TOLERANCE) {
                R_calc = 1.0;
                T_calc = 0.0;
            } else {
                T_calc = 1.0 - R_calc;
            }
        }
        
        A_calc = 1.0 - R_calc - T_calc;
        A_calc = Math.max(0.0, Math.min(1.0, A_calc));
        
        // Ensure T_calc is consistent after A_calc may have been adjusted
        T_calc = Math.max(0.0, Math.min(1.0, 1.0 - R_calc - A_calc));
        // Final check on R and T just in case
        R_calc = Math.max(0.0, Math.min(1.0, R_calc));
        T_calc = Math.max(0.0, Math.min(1.0, T_calc));


    } else { // calculationValid became false earlier, or eta0.re was <=0
      if (!(R_calc === 1 && T_calc === 0 && A_calc === 0) ) { // if not already set by eta0.re <=0
        R_calc = NaN; T_calc = NaN; A_calc = NaN; 
      }
    }

    results.push({
      wavelength: wavelength_nm,
      reflectance: isNaN(R_calc) ? 0 : R_calc,
      transmittance: isNaN(T_calc) ? 0 : T_calc,
      absorptance: isNaN(A_calc) ? 0 : A_calc,
    });
  }
  return results;
}
