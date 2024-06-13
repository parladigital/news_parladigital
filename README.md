<<<<<<< HEAD
# news_parladigital
=======
# Scraiping de Notícias
 
 Este projeto é uma ferramenta de web scraping que extrai notícias relacionadas a "leis trabalhistas", por exemplo, de vários sites e carrega os dados em uma planilha do Google Sheets para armazenamento de dados.

 ## Começando

 ### Pré-requisitos

 - Node.js instalado na sua máquina.
 - Um projeto no Google Cloud Platform com a API do Google Sheets habilitada.
 - Arquivo JSON de credenciais da conta de serviço para a API do Google Sheets.

### Instalação

1. **Clone o repositório:**

    ```sh
    git clone https://github.com/parladigital/news_parladigital.git
    cd news_parladigital
    ```

2. **Instale as dependências:**

    ```sh
    npm install
    ```

3. **Adicione suas credenciais da API do Google Sheets:**

    - Coloque o arquivo JSON de credenciais da conta de serviço na pasta `api` e renomeie-o para `electric-wave-426309-u0-1bd8b45883b7.json`.

### Executando o Script

Para executar o script e começar a capturar notícias, use o seguinte comando:

```sh
node getNewsCnn.js
```

# Como o Código Funciona
## Visão geral
O Script realiza os seguintes passos:
1. **Configuração**:
   - Inicializa o puppeteer para controlar um navegador headless.
   - Autentica com a API do Google Sheets usando as credenciais da conta de serviço.

2. **Scraiping:**
   - Faz scraping das notícias dos sites especificados (CNN Brasil, G1, Exame, TST).
   - Extrai títulos dos artigos, datas de publicação e conteúdo.
   - Filtra artigos publicados nos últimos seis meses.

3. **Armazenamento de Dados:**
   - Carrega os dados extraídos em uma planilha do Google Sheets.

## Explicação Detalhada

1. **Configuração**
   - O script inicializa o puppeteer para controlar um navegador headless:

```sh
const browser = await puppeteer.launch({ headless: true });
```
   - Em seguida, ele autentica com a API do Google Sheets usando as credenciais da conta de serviço fornecidas:

```sh
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
```

2. **Scraping**
O script contém funções para fazer scraping de notícias de diferentes sites. Aqui está um exemplo da função para a CNN Brasil:

```sh
async function scrapeSite(browser, url, linkSelector, titleSelector, dateSelector, contentSelector, source, sheets, spreadsheetId, rangeName, sixMonthsAgo) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await delay(5000);

    const newsLinks = await page.$$eval(linkSelector, links => links.map(link => link.href));
    console.log(`${source} news links found:`, newsLinks.length);

    for (const newsUrl of newsLinks) {
        await page.goto(newsUrl, { waitUntil: 'networkidle2' });
        await delay(3000);

        const [title, dateStr, content] = await page.evaluate((titleSelector, dateSelector, contentSelector) => {
            const title = document.querySelector(titleSelector)?.innerText.trim();
            const dateStr = document.querySelector(dateSelector)?.getAttribute('datetime') || document.querySelector(dateSelector)?.innerText.trim().split(' ')[0];
            const content = document.querySelector(contentSelector)?.innerText.trim();
            return [title, dateStr, content];
        }, titleSelector, dateSelector, contentSelector);

        const newsDate = new Date(dateStr.split('/').reverse().join('-'));
        if (newsDate >= sixMonthsAgo) {
            const values = [[source, `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
            const request = {
                spreadsheetId,
                range: rangeName,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            };
            await sheets.spreadsheets.values.append(request);
        }
    }
}
```

3. **Armazenamento de Dados**
O script carrega os dados extraídos no Google Sheets:
```sh
const values = [['Exame', `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
const request = {
    spreadsheetId,
    range: rangeName,
    valueInputOption: 'USER_ENTERED',
    resource: { values }
};
await sheets.spreadsheets.values.append(request);
```

# API do Google Sheets

## Configuração
Para usar a API do Google Sheets, você precisa de um projeto no Google Cloud Platform com a API do Google Sheets habilitada. Siga estes passos:

1. Acesse o Google Cloud Console.
2. Crie um novo projeto.
3. Habilite a API do Google Sheets para o seu projeto.
4. Crie uma conta de serviço e baixe o arquivo JSON de credenciais.
5. Coloque o arquivo JSON na pasta api e renomeie-o para electric-wave-426309-u0-1bd8b45883b7.json.

## Autenticação
O script usa as credenciais da conta de serviço para autenticar com a API do Google Sheets:

```sh
const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
```

# Modificando o Script para Outros Sites
Para adicionar suporte a outros sites de notícias, siga estes passos:

1. Identifique a estrutura HTML do site alvo.
2. Crie uma nova função de scraping ou modifique uma existente para extrair os dados necessários.
3. Atualize a função "scrapeNews" para incluir o novo site.

Exemplo:
```sh
console.log('Scraping NewSite...');
await scrapeSite(browser, 'https://www.newsite.com/news', 'a.news-link', 'h1.news-title', 'time.news-date', 'div.news-content', 'NewSite', sheets, spreadsheetId, rangeName, sixMonthsAgo);
```

# Acessando a API
Use as seguintes credenciais para acessar a API:

- Email: parladigitaloficial@gmail.com
- Senha: SuperSucesso2024

Certifique-se de manusear essas credenciais de forma segura e não as expor em repositórios públicos.
>>>>>>> 1682c82 (Create README.md)
