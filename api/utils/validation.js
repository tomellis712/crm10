export function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateName(name) {
  return typeof name === "string" && name.trim().length >= 2 && name.trim().length <= 80;
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

export function validateImage(image) {
  return image === "" || (
    typeof image === "string" &&
    image.length <= 750000 &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image)
  );
}
