# Scraping de Notícias

Este projeto é uma ferramenta de web scraping que extrai notícias relacionadas a "M2M e IoT" de vários sites e carrega os dados em uma planilha do Google Sheets para armazenamento de dados.

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
node scraping/getNewsMarketing.js
```

# Como o Código Funciona
## Visão geral
O Script realiza os seguintes passos:
1. **Configuração**:
   - Inicializa o Puppeteer para controlar um navegador headless.
   - Autentica com a API do Google Sheets usando as credenciais da conta de serviço.

2. **Scraiping:**
   - Faz scraping das notícias dos sites especificados (IoT Now, IoT For All, Exame, Coin Telegraph, Tec Mundo).
   - Extrai títulos dos artigos, datas de publicação e conteúdo.
   - Filtra artigos publicados nos últimos seis meses.
   - Evita duplicatas ao verificar se a notícia já está na planilha.

3. **Armazenamento de Dados:**
   - Carrega os dados extraídos em uma planilha do Google Sheets.

## Explicação Detalhada

1. **Configuração**
   - O script inicializa o puppeteer para controlar um navegador headless:

```sh
const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    defaultViewport: null,
    timeout: 300000 // Aumenta o timeout para 300 segundos
});
```
   - Em seguida, ele autentica com a API do Google Sheets usando as credenciais da conta de serviço fornecidas:

```sh
const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});
const sheets = google.sheets({ version: 'v4', auth });
```

2. **Scraping**
O script contém funções para fazer scraping de notícias de diferentes sites. Aqui está um exemplo da função para IoT Now:

```sh
async function scrapeSite(browser, site, sheets, spreadsheetId, rangeName, sixMonthsAgo, existingNews) {
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 90000 }); // Aumenta o timeout para 90 segundos
    await delay(5000);

    const newsLinks = await page.$$eval(site.linkSelector, links => links.map(link => link.href));
    console.log(`${site.name} news links found:`, newsLinks.length);

    for (const newsUrl of newsLinks) {
        if (existingNews.includes(newsUrl)) {
            console.log(`Skipping duplicate news: ${newsUrl}`);
            continue;
        }

        try {
            await page.goto(newsUrl, { waitUntil: 'networkidle2', timeout: 90000 }); // Aumenta o timeout para 90 segundos
            await delay(3000);

            const [title, dateStr, content] = await page.evaluate((site) => {
                function getMonthNumber(month) {
                    const months = {
                        'janeiro': '01',
                        'fevereiro': '02',
                        'março': '03',
                        'abril': '04',
                        'maio': '05',
                        'junho': '06',
                        'julho': '07',
                        'agosto': '08',
                        'setembro': '09',
                        'outubro': '10',
                        'novembro': '11',
                        'dezembro': '12',
                        'jan': '01',
                        'feb': '02',
                        'mar': '03',
                        'apr': '04',
                        'may': '05',
                        'jun': '06',
                        'jul': '07',
                        'aug': '08',
                        'sep': '09',
                        'oct': '10',
                        'nov': '11',
                        'dec': '12',
                        'january': '01',
                        'february': '02',
                        'march': '03',
                        'april': '04',
                        'may': '05',
                        'june': '06',
                        'july': '07',
                        'august': '08',
                        'september': '09',
                        'october': '10',
                        'november': '11',
                        'december': '12'
                    };
                    return months[month.toLowerCase()];
                }

                const title = document.querySelector(site.titleSelector)?.innerText.trim();
                let dateStr = document.querySelector(site.dateSelector)?.innerText.trim();

                if (site.name === 'IoT Now' || site.name === 'IoT For All') {
                    const match = dateStr.match(/(\w+) (\d{2}), (\d{4})/);
                    if (match) {
                        const [month, day, year] = [getMonthNumber(match[1]), match[2], match[3]];
                        dateStr = `${year}-${month}-${day}`;
                    }
                } else if (site.name === 'Exame') {
                    const match = dateStr.match(/Publicado em (\d{1,2}) de (\w+) de (\d{4}) às (\d{2}h\d{2})/);
                    if (match) {
                        const [day, month, year] = [match[1], getMonthNumber(match[2]), match[3]];
                        dateStr = `${year}-${month}-${day}`;
                    }
                } else if (site.name === 'Coin telegraph') {
                    const match = dateStr.match(/(\d{2}) (\w{3}) (\d{4})/);
                    if (match) {
                        const [day, month, year] = [match[1], getMonthNumber(match[2]), match[3]];
                        dateStr = `${year}-${month}-${day}`;
                    }
                } else if (site.name === 'Tec Mundo') {
                    const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
                    if (match) {
                        dateStr = `${match[3]}-${match[2]}-${match[1]}`;
                    }
                }

                const content = Array.from(document.querySelectorAll(site.contentSelector))
                    .map(el => el.innerText.trim()).join('\n');
                return [title, dateStr, content];
            }, site);

            console.log(`Processed news from ${newsUrl} with title: ${title} and date: ${dateStr}`);
            const newsDate = new Date(dateStr);
            if (isNaN(newsDate.getTime())) {
                console.log(`Skipping news from ${newsUrl} due to invalid date format: ${dateStr}`);
                continue;
            }

            console.log(`Converted news date: ${newsDate}`);
            console.log(`Comparing news date with six months ago: ${sixMonthsAgo}`);
            if (newsDate >= sixMonthsAgo) {
                if (content.length > 50000) {
                    console.log(`Skipping news from ${newsUrl} due to content length exceeding 50000 characters.`);
                    continue;
                }
                const values = [[site.name, `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
                const request = {
                    spreadsheetId,
                    range: rangeName,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values }
                };
                await sheets.spreadsheets.values.append(request);
                console.log(`Added news to spreadsheet: ${title}`);
            } else {
                console.log(`News from ${newsUrl} is older than six months.`);
            }
        } catch (error) {
            console.error(`Error processing news article at ${newsUrl}:`, error);
        }
    }
}
```

3. **Armazenamento de Dados**
O script carrega os dados extraídos no Google Sheets:
```sh
const values = [[site.name, `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
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
5. Coloque o arquivo JSON na pasta api e renomeie-o para "electric-wave-426309-u0-1bd8b45883b7.json".

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
Para adicionar suporte a outros sites de notícias, atualize o array sites com a estrutura HTML do novo site. Aqui está um exemplo do array sites:

Exemplo:
```sh
const sites = [
    {
        name: 'IoT Now',
        url: 'https://www.iot-now.com/news/',
        linkSelector: 'h2.category__title a',
        titleSelector: 'h1.entry-title',
        dateSelector: 'time.entry-date',
        contentSelector: 'div.article__content',
        dateFormat: 'text'
    },
    {
        name: 'IoT For All',
        url: 'https://www.iotforall.com/articles',
        linkSelector: 'a.vari_filter_inner',
        titleSelector: 'h1.ih1_seo_heading',
        dateSelector: 'time.entry-date',
        contentSelector: 'div.td-post-content',
        dateFormat: 'text'
    },
    {
        name: 'Exame',
        url: 'https://exame.com/noticias-sobre/internet-das-coisas-iot/',
        linkSelector: 'a.touch-area',
        titleSelector: 'h1.headline-large',
        dateSelector: 'p.body-small',
        contentSelector: '#news-body p, #news-body div',
        dateFormat: 'Publicado em d mmmm yyyy às HH:mm'
    },
    {
        name: 'Coin telegraph',
        url: 'https://br.cointelegraph.com/tags/internet-of-things',
        linkSelector: 'a.post-card-inline__title-link',
        titleSelector: 'h1.post__title',
        dateSelector: '.post-meta__publish-date time',
        contentSelector: 'div.post-content relative',
        dateFormat: 'text'
    },
    {
        name: 'Tec Mundo',
        url: 'https://www.tecmundo.com.br/internet-das-coisas',
        linkSelector: '.tec--card__title__link',
        titleSelector: 'h1.tec--article__header__title',
        dateSelector: '#js-article-date strong',
        contentSelector: 'div.tec--article__body',
        dateFormat: 'datetime'
    },
];
```

# Configuração do Cron Job com GitHub Actions
 O cron job está configurado para rodar automaticamente todos os dias às 8h da manhã no horário UTC (5h da manhã no horário de Brasília). Aqui está o código do workflow do GitHub Actions:

 Explicação
 1. Checkout repository: Faz o checkout do repositório.
 2. Setup Node.js: Configura o Node.js com a versão 16.
 3. Install dependencies: Instala as dependências listadas no package.json.
 4. Fix vulnerabilities: Executa npm audit fix --force para corrigir vulnerabilidades.
 5. Install system dependencies: Instala as dependências do sistema necessárias para rodar o Puppeteer.
 6. Set up Google credentials: Configura as credenciais da API do Google Sheets usando o segredo armazenado no GitHub.
 7. Run scraping scripts: Itera sobre todos os arquivos .js dentro da pasta scraping e executa cada um deles. Se algum script falhar, o job é interrompido (|| exit 1).
 8. Upload error logs: Se ocorrer uma falha, faz upload dos logs de erro.
 9. Report success: Se todos os scripts forem executados com sucesso, imprime uma mensagem de sucesso.

### Garantindo Execução Forçada
Para garantir que os scripts sempre rodem, adicionamos || exit 1 ao comando que executa cada script. Isso garante que, se algum script falhar, o job será interrompido, forçando a verificação e correção do problema.

Com essa configuração, qualquer novo script adicionado à pasta scraping será automaticamente executado pelo workflow sem necessidade de modificar o arquivo YAML.

```sh
name: Scrape News

on:
  schedule:
    - cron: '0 11 * * *'
  workflow_dispatch:

jobs:
  scrape:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout repository
      uses: actions/checkout@v2

    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '16'

    - name: Install dependencies
      run: npm install

    - name: Fix vulnerabilities
      run: npm audit fix --force

    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y libnss3-dev libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon-x11-0 libxcomposite1 libxrandr2 libgbm-dev

    - name: Set up Google credentials
      env:
        GOOGLE_APPLICATION_CREDENTIALS: ${{ secrets.GOOGLE_APPLICATION_CREDENTIALS }}
      run: echo "${{ secrets.GOOGLE_APPLICATION_CREDENTIALS }}" > api/electric-wave-426309-u0-1bd8b45883b7.json

    - name: Run scraping scripts
      run: |
        for script in scraping/*.js; do
          node $script || exit 1
        done
      env:
        GOOGLE_APPLICATION_CREDENTIALS: api/electric-wave-426309-u0-1bd8b45883b7.json

    - name: Upload error logs
      if: failure()
      uses: actions/upload-artifact@v2
      with:
        name: error-logs
        path: error.log

    - name: Report success
      if: success()
      run: echo "Scraping completed successfully."
```

# Acessando a API
Use as seguintes credenciais para acessar a API:

- Email: parladigitaloficial@gmail.com
- Senha: SuperSucesso2024

Certifique-se de manusear essas credenciais de forma segura e não as expor em repositórios públicos.

### Pontos de Verificação

- Verifique se o caminho do script `scraping/getNewsLaws.js` está correto no GitHub Actions.
- Certifique-se de que as credenciais da API do Google Sheets estão configuradas corretamente nos segredos do repositório no GitHub.

### Testando e Verificando

- Após fazer commit e push das alterações, monitore a execução do cron job no GitHub Actions e verifique os logs para garantir que o script está rodando conforme esperado.
- Verifique se os dados estão sendo corretamente adicionados à planilha do Google Sheets sem duplicatas.

