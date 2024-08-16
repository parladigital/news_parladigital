const axios = require("axios");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

// Configuração da API da OpenAI
const apiKey = "sk-proj-psfGW4pgyPvk5kXOq178T3BlbkFJ1ymtUZ0Kijz9CWawC1Xm";
const openaiUrl = "https://api.openai.com/v1/completions";

// Configuração da API do Google Sheets
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = "16956oAxKOXcV3-hqE4_AqTisN3_ZWfdukV7bkrQCrzw";
const rangeName = "idea_rea_basilio!A2:D"; // Adiciona na aba específica

// Função para gerar ideias de posts e textos
async function gerarIdeias() {
  const prompt = `
    Gerar três ideias únicas de posts de blog para a empresa "Rea & Basilio Advogadas" abordando os seguintes temas:

    1. Direito do Trabalho: Assessoria e Consultoria Jurídica, Reclamações Trabalhistas, Acidente de Trabalho, Cálculos Trabalhistas.
    2. Direito Previdenciário: Aposentadoria, Indenizações, Pensão por Morte.
    3. Direito Imobiliário: Consultoria Preventiva, Usucapião, Regularização de Imóveis, Diligências em Cartório Extrajudicial, Contencioso Administrativo e Judicial.
    4. Direito de Família e Danos Pessoais: Divórcio, Investigação de Paternidade, Pensão Alimentícia, Alteração de Guarda, Curatela e Tutela.
    5. Direito do Consumidor: Danos Patrimoniais, Danos Morais, Cobranças Indevidas.
    6. Direito Eletrônico e Digital: Crimes Eletrônicos, Ataques Virtuais, Propriedade Intelectual, Segurança da Informação (LGPD), Marcas e Patentes, Consultivo para StartUps.
    7. Cidadania Italiana e Portuguesa: Autorização de Residência, Transcrição de Casamento, Reconhecimento de Sentença Estrangeira, Certificação e Autenticação de Documentos, Tradução de Documentos, Emissão de Inteiro Teor, Análise Jurídica da Pasta.

    As ideias de post devem estar alinhadas com a missão, visão e valores da empresa, que incluem honestidade, transparência e empatia.
    `;
  try {
    const response = await axios.post(
      openaiUrl,
      {
        model: "gpt-4",
        prompt: prompt,
        max_tokens: 1000,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.choices[0].text.trim();
  } catch (error) {
    console.error(
      "Erro ao chamar a API do OpenAI:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Falha ao gerar ideias com a API do OpenAI");
  }
}

// Função para verificar se a ideia é repetida
function ideiaRepetida(novaIdeia, existingIdeas) {
  return existingIdeas.some(
    (idea) => idea.title.trim().toLowerCase() === novaIdeia.trim().toLowerCase()
  );
}

// Função para carregar ideias existentes da planilha
async function getExistingIdeas() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeName,
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }
  return rows.map((row) => ({ title: row[2], content: row[3] }));
}

// Função principal
async function main() {
  // Carregar ideias existentes
  const existingIdeas = await getExistingIdeas();

  // Gerar novas ideias
  const novasIdeias = await gerarIdeias();
  const linhas = novasIdeias.split("\n\n");
  let newIdeas = [];

  for (const linha of linhas) {
    const [titulo, ...textoArray] = linha.split("\n");
    const texto = textoArray.join("\n");

    if (!ideiaRepetida(titulo, existingIdeas)) {
      newIdeas.push({
        source: "IA",
        date: new Date().toISOString().split("T")[0],
        title: titulo.trim(),
        content: texto.trim(),
      });
    }
  }

  // Adicionar novas ideias na planilha Google Sheets
  if (newIdeas.length > 0) {
    const values = newIdeas.map((idea) => [
      idea.source,
      idea.date,
      idea.title,
      idea.content,
    ]);
    const resource = { values };

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: rangeName,
      valueInputOption: "USER_ENTERED",
      resource,
    });

    console.log("Ideias de posts adicionadas na planilha com sucesso!");
  } else {
    console.log("Nenhuma nova ideia foi gerada.");
  }
}

// Executar a função principal
main().catch((error) => console.error("Erro ao gerar ideias de posts:", error));
