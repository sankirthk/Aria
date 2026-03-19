// utils/validation.ts
export const validateEmail = (email: string): string => {
  if (!email.trim()) return "Email is required";

  // RFC-5322 compliant pattern (used by Gmail & major services)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(email.trim()))
    return "Please enter a valid email address";

  return "";
};

export const validatePassword = (password: string): string => {
  if (!password.trim()) return "Password is required";

  if (password.length < 8) return "Password must be at least 8 characters long";

  // Require upper, lower, digit, and at least one symbol (accept any non-alphanumeric)
  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^\w\s])\S{8,}$/;

  if (!passwordRegex.test(password))
    return "Password must include uppercase, lowercase, number, and special character";

  return "";
};

export const validateRePassword = (
  password: string,
  repassword: string
): string => {
  if (!repassword.trim()) return "Please re-enter your password";

  if (repassword !== password) return "Passwords do not match";

  return "";
};

export const validatePhone = (phone: string): string => {
  if (!phone.trim()) return "Phone number is required";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return "Enter a valid phone number (at least 10 digits)";
  if (digits.length > 15) return "Phone number is too long";
  return "";
};

export const validateDob = (dob: string): string => {
  if (!dob) return "Date of birth is required";
  const date = new Date(dob);
  if (isNaN(date.getTime())) return "Enter a valid date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) return "Date of birth cannot be in the future";
  const hundredYearsAgo = new Date();
  hundredYearsAgo.setFullYear(hundredYearsAgo.getFullYear() - 100);
  if (date < hundredYearsAgo) return "Date of birth cannot be more than 100 years ago";
  return "";
};

export const validateName = (name: string): string => {
  const trimmed = name.trim();

  if (!trimmed) return "Name cannot be empty";
  if (trimmed.length < 2) return "Name must be at least 2 characters long";

  // Allow only letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ' -]+$/;

  if (!nameRegex.test(trimmed))
    return "Name can only contain letters, spaces, hyphens, or apostrophes";

  return "";
};
