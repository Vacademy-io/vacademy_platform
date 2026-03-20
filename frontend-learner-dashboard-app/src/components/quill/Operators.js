export const MATH_OPERATORS = [
    ["+", "+"],
    ["-", "-"],
    ["\\ldotp", "."],
    ["\\times", "\\times"],
    ["\\div", "\\div"],
    ["=", "="],
    ["(", "("], // Left parenthesis
    [")", ")"], // Right parenthesis
    ["[", "["], // Left square bracket
    ["]", "]"], // Right square bracket
    ["\\lbrace", "\\lbrace"], // Left curly brace (lbrace)
    ["\\rbrace", "\\rbrace"], // Right curly brace (rbrace)
    ["\\pi", "\\pi"], // Pi symbol (π)
    ["e", "e"], // Exponential base (e)
    ["\\infty", "\\infty"], // Infinity symbol (∞)
    ["\\frac{x}{y}", "\\frac"], // Infinity symbol (∞)
    ["x^2", "x^2"], // Square (explicit)
    ["x^{n}", "x^{n}"], // nth power notation
    ["^{}", "^{}"], // Subscript
    ["|x|", "|x|"],
    ["\\%", "\\%"],
    ["\\pm", "\\pm"],
    ["\\neq", "\\neq"], // Not equal to (≠)
    ["<", "<"], // Less than (<)
    [">", ">"], // Greater than (>)
    ["\\N", "\\N"], // Natural numbers (ℕ)
    ["\\Z", "\\Z"], // Natural numbers (ℕ)
    ["\\mathbb{Q}", "\\Q"], // Rational numbers (ℚ)
    ["\\Reals", "\\R"], // Rational numbers (ℚ)
    ["\\cnums", "\\C"], // Rational numbers (ℚ)
    ["\\sqrt{x}", "\\sqrt"],
    ["\\sqrt[n]{x}", "\\nthroot"],
    ["\\overline{x}", "\\overline{x}"], // Bar symbol on top of 'x'
    ["\\overleftarrow{x}", "\\overleftarrow{x}"], // Left arrow over 'x'
    ["\\overrightarrow{x}", "\\overrightarrow{x}"], // Right arrow over 'x'
    ["\\angle", "\\angle"], // Angle symbol (∠)
    ["\\degree", "^\\circ"], // Degree symbol (°)
    ["\\circ", "\\circ"], // Small circle symbol (∘)
    ["\\leq", "\\leq"], // Less than or equal to (≤)
    ["\\geq", "\\geq"], // Greater than or equal to (≥)
    ["\\forall", "\\forall"], // Universal quantifier (∀)
    ["\\exists", "\\exists"], // Existential quantifier (∃)
    ["\\in", "\\in"], // Element of (∈)
    ["\\notin", "\\notin"], // Not element of (∉)
    ["\\emptyset", "\\emptyset"], // Empty set (∅)
    ["\\lim_{a \\to b}", "\\lim_{a \\to b}"], // Limit symbol with a -> b
    ["\\sum_{i=a}^{b}", "\\sum_{i=a}^{b}"], // Summation from a to b
    ["\\prod_{a}^{a}", "\\prod_{a}^{a}"], // Product from a to a
    ["⌈ ⌉", "⌈ ⌉"],
    ["⌊ ⌋", "⌊ ⌋"],
    ["\\perp", "\\perp"], // Perpendicular symbol (⊥)
    ["\\parallel", "\\parallel"], // Parallel symbol (‖)
    ["\\Leftarrow", "\\Leftarrow"],
    ["\\Rightarrow", "\\Rightarrow"], // Rightwards double arrow (⇒)
    ["\\Leftrightarrow", "\\Leftrightarrow"], // If and only if (⇔)
    ["\\land", "\\land"], // Logical AND (∧)
    ["\\lor", "\\lor"], // Logical OR (∨)
    ["\\subset", "\\subset"], // Subset (⊂)
    ["\\not\\subset", "\\not\\subset"], // Not a subset (⊄)
    ["\\neg", "\\neg"], // Negation (¬)
    ["\\ln", "\\ln"], // Natural logarithm (ln)
    ["\\log_{10}", "\\log_{10}"], // Logarithm base 10 (log₁₀)
    ["\\log_{a}", "\\log_{a}"], // Logarithm with base 'a' (logₐ)
    ["\\int_{a}^{b}", "\\int_{a}^{b}"], // Integral with limits (∫ₐᵇ)
    ["\\frac{dx}{dy}", "\\frac{dx}{dy}"], // Fraction dx/dy (dx/dy)
    ["\\sim", "\\sim"], // Tilde (∼)
    ["\\approx", "\\approx"], // Approximately equal to (≈)
    ["\\leftarrow", "\\leftarrow"], // Left arrow (←)
    ["\\rightarrow", "\\rightarrow"], // Right arrow (→)
    ["\\leftrightarrow", "\\leftrightarrow"], // Bi-directional arrow (↔)
    ["\\cap", "\\cap"], // Intersection (∩)
    ["\\cup", "\\cup"], // Union (∪)
    ["\\subseteq", "\\subseteq"], // Subset or equal to (⊆)
    ["\\not\\subseteq", "\\not\\subseteq"], // Not a subset or equal to (⊈)
    ["\\backslash", "\\backslash"], // Set difference (\backslash)
];

export const GREEK_OPERATORS = [
    ["\\Alpha", "\\Alpha"], // Greek letter Alpha (Α)
    ["\\Beta", "\\Beta"], // Greek letter Beta (Β)
    ["\\Gamma", "\\Gamma"], // Greek letter Gamma (Γ)
    ["\\Delta", "\\Delta"], // Greek letter Delta (Δ)
    ["\\Epsilon", "\\Epsilon"], // Greek letter Epsilon (Ε)
    ["\\alpha", "\\alpha"], // Greek letter alpha (α)
    ["\\beta", "\\beta"], // Greek letter beta (β)
    ["\\gamma", "\\gamma"], // Greek letter gamma (γ)
    ["\\delta", "\\delta"], // Greek letter delta (δ)
    ["\\epsilon", "\\epsilon"], // Greek letter epsilon (ε)
    ["\\zeta", "\\zeta"], // Greek letter zeta (ζ)
    ["\\eta", "\\eta"], // Greek letter eta (η)
    ["\\Zeta", "\\Zeta"], // Greek letter Zeta (Ζ)
    ["\\Eta", "\\Eta"], // Greek letter Eta (Η)
    ["\\Theta", "\\Theta"], // Greek letter Theta (Θ)
    ["\\Iota", "\\Iota"], // Greek letter Iota (Ι)
    ["\\Kappa", "\\Kappa"], // Greek letter Kappa (Κ)
    ["\\theta", "\\theta"], // Greek letter theta (θ)
    ["\\iota", "\\iota"], // Greek letter iota (ι)
    ["\\kappa", "\\kappa"], // Greek letter kappa (κ)
    ["\\lambda", "\\lambda"], // Greek letter lambda (λ)
    ["\\mu", "\\mu"], // Greek letter mu (μ)
    ["\\nu", "\\nu"], // Greek letter nu (ν)
    ["\\xi", "\\xi"], // Greek letter xi (ξ)
    ["\\Lambda", "\\Lambda"], // Greek letter Lambda (Λ)
    ["\\Mu", "\\Mu"], // Greek letter Mu (Μ)
    ["\\Nu", "\\Nu"], // Greek letter Nu (Ν)
    ["\\Xi", "\\Xi"], // Greek letter Xi (Ξ)
    ["\\Omicron", "\\Omicron"], // Greek letter Omicron (Ο)
    ["\\omicron", "\\omicron"], // Greek letter omicron (ο)
    ["\\pi", "\\pi"], // Greek letter pi (π)
    ["\\rho", "\\rho"], // Greek letter rho (ρ)
    ["\\varsigma", "\\varsigma"], // Greek letter final sigma (ς)
    ["\\sigma", "\\sigma"], // Greek letter sigma (σ)
    ["\\tau", "\\tau"], // Greek letter tau (τ)
    ["\\upsilon", "\\upsilon"], // Greek letter upsilon (υ)
    ["\\Pi", "\\Pi"], // Greek letter Pi (Π)
    ["\\Rho", "\\Rho"], // Greek letter Rho (Ρ)
    ["\\Sigma", "\\Sigma"], // Greek letter Sigma (Σ)
    ["\\Tau", "\\Tau"], // Greek letter Tau (Τ)
    ["\\Upsilon", "\\Upsilon"], // Greek letter Upsilon (Υ)
    ["\\phi", "\\phi"], // Greek letter phi (φ)
    ["\\chi", "\\chi"], // Greek letter chi (χ)
    ["\\psi", "\\psi"], // Greek letter psi (ψ)
    ["\\omega", "\\omega"], // Greek letter omega (ω)
    ["\\partial", "\\partial"], // Greek letter partial (∂)
    ["\\varepsilon", "\\varepsilon"], // Greek letter epsilon (ϵ)
    ["\\vartheta", "\\vartheta"], // Greek letter theta variant (ϑ)
    ["\\Phi", "\\Phi"], // Greek letter Phi (Φ)
    ["\\Chi", "\\Chi"], // Greek letter Chi (Χ)
    ["\\Psi", "\\Psi"], // Greek letter Psi (Ψ)
    ["\\Omega", "\\Omega"], // Greek letter Omega (Ω)
    ["\\nabla", "\\nabla"], // Greek letter Nabla (∇)
    ["\\kappa", "\\kappa"], // Greek letter kappa (ϰ)
    ["\\varphi", "\\varphi"], // Greek letter phi (ɸ)
    ["\\varrho", "\\varrho"], // Greek letter rho (ϱ)
    ["\\varpi", "\\varpi"], // Greek letter pi variant (ϖ)
];

export const ALL_OPERATORS = [...MATH_OPERATORS, ...GREEK_OPERATORS];
