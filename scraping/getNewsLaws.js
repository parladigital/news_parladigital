async function scrapeSite(browser, site, sheets, sixMonthsAgo, existingNews) {
    const page = await browser.newPage();
    await page.goto(site.url, { waitUntil: 'networkidle2', timeout: 90000 });
    console.log(`Navigating to ${site.url}`);

    try {
        await page.waitForSelector(site.linkSelector, { timeout: 30000 });
    } catch (error) {
        console.error(`Error waiting for link selector on ${site.name}: ${error}`);
        return;  // Saímos da função se o seletor não for encontrado
    }

    const newsLinks = await page.$$eval(site.linkSelector, links => links.map(link => link.href));
    console.log(`${site.name} news links found:`, newsLinks.length);

    for (const newsUrl of newsLinks) {
        if (existingNews.includes(newsUrl)) {
            console.log(`Skipping duplicate news: ${newsUrl}`);
            continue;
        }
        console.log(`Processing news URL: ${newsUrl}`);
        await page.goto(newsUrl, { waitUntil: 'networkidle2', timeout: 90000 });
        await page.waitForTimeout(3000);

        const [title, dateStr, content] = await page.evaluate((site) => {
            const title = document.querySelector(site.titleSelector)?.innerText.trim() || 'No title found';
            const dateElement = document.querySelector(site.dateSelector);
            const dateStr = dateElement ? dateElement.getAttribute('datetime') || dateElement.innerText.trim() : 'No date found';
            const content = document.querySelector(site.contentSelector)?.innerText.trim() || 'No content found';
            return [title, dateStr, content];
        }, site);

        if (!title || !dateStr || !content || title === 'No title found' || dateStr === 'No date found' || content === 'No content found') {
            console.log(`Incomplete data from ${newsUrl}, skipping...`);
            continue;
        }

        const newsDate = new Date(dateStr);
        if (newsDate >= sixMonthsAgo) {
            const values = [[site.name, `${newsDate.getDate()}/${newsDate.getMonth() + 1}/${newsDate.getFullYear()}`, newsUrl, title, content]];
            const request = {
                spreadsheetId: config.spreadsheetId,
                range: config.rangeName,
                valueInputOption: 'USER_ENTERED',
                resource: { values }
            };
            await sheets.spreadsheets.values.append(request);
            console.log(`Data appended for ${site.name}`);
        }
    }
}
