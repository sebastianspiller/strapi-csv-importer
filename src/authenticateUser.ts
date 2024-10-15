export default async function authenticateUser(
  email: string,
  password: string,
) {
  const response = await fetch(`${process.env.STRAPI_URL}/api/auth/local`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier: email, // E-Mail or Username
      password: password,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `Authentifizierung fehlgeschlagen: ${errorData.error.message}`,
    );
  }

  const data = await response.json();
  return data.jwt;
}
