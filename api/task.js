const inventory = [
  { sku: "A101", system: 20, physical: 18 },
  { sku: "B205", system: 12, physical: 15 },
  { sku: "C310", system: 9, physical: 9 }
];

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({
      inventory,
      simulated: true
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const valid =
      body &&
      Array.isArray(body.values) &&
      body.values.length === 3 &&
      ["Sí", "No"].includes(body.assistance) &&
      body.values.every(
        (v) =>
          typeof v === "number" &&
          Number.isInteger(v) &&
          Math.abs(v) <= 999
      );

    if (!valid) {
      return res.status(400).json({
        error: "Datos inválidos"
      });
    }

    const checks = inventory.map((item, index) => {
      const expected = item.physical - item.system;

      return {
        sku: item.sku,
        expected,
        submitted: body.values[index],
        pass: body.values[index] === expected
      };
    });

    const evaluation = {
      checks,
      passed: checks.filter((item) => item.pass).length,
      total: 3,
      assistance: body.assistance,
      verified: "Diferencias de inventario simulado",
      notVerified: [
        "Identidad",
        "Experiencia laboral real",
        "Desempeño en una empresa",
        "Colaboración"
      ]
    };

    if (req.query.action !== "feedback") {
      return res.status(200).json(evaluation);
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "OpenAI no está configurado"
      });
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          instructions:
            "Eres un tutor de inventarios en México. Explica los errores de manera clara, breve y constructiva. No modifiques la calificación matemática. Los datos son simulados y no certifican experiencia laboral.",
          input: JSON.stringify(checks),
          max_output_tokens: 150
        })
      }
    );

    if (!response.ok) {
      return res.status(502).json({
        error: "No se pudo obtener respuesta de OpenAI"
      });
    }

    const result = await response.json();

    const explanation = (result.output || [])
      .flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join(" ");

    return res.status(200).json({
      simulated: false,
      text: explanation
    });
  } catch (error) {
    return res.status(500).json({
      error: "Error al procesar la solicitud"
    });
  }
};
