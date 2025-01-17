const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const fs = require("fs");

const sites = [
  {
    name: "Agencia Mestre - SEO",
    url: "https://www.agenciamestre.com/categoria/seo/",
    linkSelector: ".titulo-post a",
    titleSelector: "h1.mobile_title",
    dateSelector: "div.user-name-post span.single-post-icon time",
    contentSelector: "div.post-content",
    dateFormat: "datetime",
  },
  {
    name: "Agencia Mestre - Marketing Digital",
    url: "https://www.agenciamestre.com/categoria/marketing-digital/",
    linkSelector: ".titulo-post a",
    titleSelector: "h1.mobile_title",
    dateSelector: "div.user-name-post span.single-post-icon time",
    contentSelector: "div.post-content",
    dateFormat: "datetime",
  },
  {
    name: "Agencia Tribo - Marketing Digital",
    url: "https://agenciatribo.com.br/conteudo/marketing-digital/",
    linkSelector: ".elementor-post__title a",
    titleSelector: "h1.elementor-heading-title",
    dateSelector: "span.elementor-post-info__item--type-date",
    contentSelector: "div.elementor-widget-container",
    dateFormat: "datetime",
  },
  {
    name: "Agencia Tribo - SEO",
    url: "https://agenciatribo.com.br/conteudo/seo/",
    linkSelector: ".elementor-post__title a",
    titleSelector: "h1.elementor-heading-title",
    dateSelector: "span.elementor-post-info__item--type-date",
    contentSelector: "div.elementor-widget-container",
    dateFormat: "datetime",
  },
  {
    name: "Agencia Tribo - Inbound",
    url: "https://agenciatribo.com.br/conteudo/inbound-marketing/",
    linkSelector: ".elementor-post__title a",
    titleSelector: "h1.elementor-heading-title",
    dateSelector: "span.elementor-post-info__item--type-date",
    contentSelector: "div.elementor-widget-container",
    dateFormat: "datetime",
  },
  {
    name: "Sem Rush - Marketing",
    url: "https://pt.semrush.com/blog/category/marketing/",
    linkSelector: ".sc-htJRVC",
    titleSelector: "h1.sc-kLwhqv",
    dateSelector: 'span.sc-kLwhqv [data-test="date"]',
    contentSelector: "div.sc-bdvvtL",
    dateFormat: "text",
  },
  {
    name: "Sem Rush - SEO",
    url: "https://pt.semrush.com/blog/category/seo/",
    linkSelector: ".sc-bUhFKy",
    titleSelector: "h1.sc-kLwhqv",
    dateSelector: 'span.sc-kLwhqv [data-test="date"]',
    contentSelector: "div.sc-bdvvtL",
    dateFormat: "text",
  },
];

async function scrapeNews() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
    defaultViewport: null,
    timeout: 300000, // Aumenta o timeout para 300 segundos
  });

  const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = "1BtE0RhK8AHlDWru9kt8MhI2mwQtS6RSU4_B9BYkTVkg";
  const rangeName = "news_marketing!A2:F";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const existingNews = await getExistingNews(sheets, spreadsheetId, rangeName);

  for (const site of sites) {
    console.log(`Scraping ${site.name}...`);
    try {
      await scrapeSite(
        browser,
        site,
        sheets,
        spreadsheetId,
        rangeName,
        yesterday,
        existingNews
      );
    } catch (error) {
      console.error(`Error scraping ${site.name}:`, error);
    }
  }

  await browser.close();
  console.log("Scraping completed.");
}

async function getExistingNews(sheets, spreadsheetId, rangeName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: rangeName,
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }
  return rows.map((row) => row[2]);
}

async function scrapeSite(
  browser,
  site,
  sheets,
  spreadsheetId,
  rangeName,
  yesterday,
  existingNews
) {
  const page = await browser.newPage();
  await page.goto(site.url, { waitUntil: "networkidle2", timeout: 90000 }); // Aumenta o timeout para 90 segundos
  await delay(5000);

  const newsLinks = await page.$$eval(site.linkSelector, (links) =>
    links.map((link) => link.href)
  );
  console.log(`${site.name} news links found:`, newsLinks.length);

  for (const newsUrl of newsLinks) {
    if (existingNews.includes(newsUrl)) {
      console.log(`Skipping duplicate news: ${newsUrl}`);
      continue;
    }

    try {
      await page.goto(newsUrl, { waitUntil: "networkidle2", timeout: 90000 }); // Aumenta o timeout para 90 segundos
      await delay(3000);

      const [title, dateStr, content] = await page.evaluate((site) => {
        function getMonthNumber(month) {
          const months = {
            janeiro: "01",
            fevereiro: "02",
            março: "03",
            abril: "04",
            maio: "05",
            junho: "06",
            julho: "07",
            agosto: "08",
            setembro: "09",
            outubro: "10",
            novembro: "11",
            dezembro: "12",
            jan: "01",
            feb: "02",
            mar: "03",
            apr: "04",
            may: "05",
            jun: "06",
            jul: "07",
            aug: "08",
            sep: "09",
            oct: "10",
            nov: "11",
            dec: "12",
          };
          return months[month.toLowerCase()];
        }

        const title = document
          .querySelector(site.titleSelector)
          ?.innerText.trim();
        let dateStr = document
          .querySelector(site.dateSelector)
          ?.innerText.trim();
        if (
          site.name === "Agencia Mestre - SEO" &&
          site.name === "Agencia Mestre - Marketing Digital" &&
          site.name === "Agencia Tribo - Marketing Digital" &&
          site.name === "Agencia Tribo - SEO" &&
          site.name === "Agencia Tribo - Inbound"
        ) {
          dateStr = document
            .querySelector(site.dateSelector)
            ?.getAttribute("datetime");
        } else if (site.name.includes("Sem Rush")) {
          const match = dateStr.match(/(\w{3}) (\d{2}), (\d{4})/);
          if (match) {
            const [month, day, year] = [
              getMonthNumber(match[1]),
              match[2],
              match[3],
            ];
            dateStr = `${year}-${month}-${day}`;
          }
        }
        const content = Array.from(
          document.querySelectorAll(site.contentSelector)
        )
          .map((el) => el.innerText.trim())
          .join("\n");
        return [title, dateStr, content];
      }, site);

      console.log(
        `Processed news from ${newsUrl} with title: ${title} and date: ${dateStr}`
      );
      const newsDate = new Date(dateStr);
      console.log(`Converted news date: ${newsDate}`);
      if (newsDate >= yesterday) {
        if (content.length > 50000) {
          console.log(
            `Skipping news from ${newsUrl} due to content length exceeding 50000 characters.`
          );
          continue;
        }
        const now = new Date();
        const addedDate = `${now.getDate()}/${
          now.getMonth() + 1
        }/${now.getFullYear()}`;
        const values = [
          [
            site.name,
            `${newsDate.getDate()}/${
              newsDate.getMonth() + 1
            }/${newsDate.getFullYear()}`,
            addedDate,
            newsUrl,
            title,
            content,
          ],
        ];

        const request = {
          spreadsheetId,
          range: rangeName,
          valueInputOption: "USER_ENTERED",
          resource: { values },
        };
        await sheets.spreadsheets.values.append(request);
        console.log(`Added news to spreadsheet: ${title}`);
      } else {
        console.log(`News from ${newsUrl} is older than yesterday.`);
      }
    } catch (error) {
      console.error(`Error processing news article at ${newsUrl}:`, error);
    }
  }
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

scrapeNews();
