const PORT = process.env.PORT || 8000; // Use the port provided by Heroku or fallback to 8000 for local development
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();

async function scrapeBBC() {
    const articles = [];
    const response = await axios.get('https://www.bbc.com/innovation/artificial-intelligence');
    const html = response.data;
    const $ = cheerio.load(html);
    const fetchTime = new Date().toISOString();

    $('a[href*="/news/"]').each(function () {
        const title = $(this).find('h2').text().trim();
        const articleUrl = $(this).attr('href');

        if (title && articleUrl && !articleUrl.includes('/reel/video/')) {
            const fullUrl = articleUrl.startsWith('http') ? articleUrl : `https://www.bbc.com${articleUrl}`;
            articles.push({
                title,
                url: fullUrl,
                source: 'BBC',
                fetched_at: fetchTime
            });
        }
    });

    for (const article of articles) {
        const response = await axios.get(article.url);
        const html = response.data;
        const $ = cheerio.load(html);

        const paragraphs = [];
        $('div[data-component="text-block"] p').each(function () {
            paragraphs.push($(this).text());
        });

        article.text = paragraphs.join('\n');
    }

    return articles;
}

async function scrapeGuardian() {
    const articles = [];
    const response = await axios.get('https://www.theguardian.com/technology/artificialintelligenceai');
    const html = response.data;
    const $ = cheerio.load(html);
    const fetchTime = new Date().toISOString();

    $('a').each(function () {
        const title = $(this).text().trim();
        const articleUrl = $(this).attr('href');
        const ariaLabel = $(this).attr('aria-label');

        if (ariaLabel && ariaLabel.toLowerCase().includes('ai')) {
            const fullUrl = articleUrl.startsWith('http') ? articleUrl : `https://www.theguardian.com${articleUrl}`;
            articles.push({
                title: ariaLabel || title,
                url: fullUrl,
                source: 'Guardian',
                fetched_at: fetchTime
            });
        }
    });

    for (const article of articles) {
        const response = await axios.get(article.url);
        const html = response.data;
        const $ = cheerio.load(html);

        const paragraphs = [];
        $('div.article-body-commercial-selector p').each(function () {
            paragraphs.push($(this).text());
        });

        article.text = paragraphs.join('\n');
    }

    return articles;
}

async function scrapeUSAToday() {
    const articles = [];
    const response = await axios.get('https://www.usatoday.com/tech/');
    const html = response.data;
    const $ = cheerio.load(html);
    const fetchTime = new Date().toISOString();

    $('a').each(function () {
        const articleUrl = $(this).attr('href');

        if (articleUrl && (/-ai\b|ai-|ai-\b/.test(articleUrl))) {
            const title = $(this).text().trim();
            if (title) {
                const fullUrl = articleUrl.startsWith('http') ? articleUrl : `https://www.usatoday.com${articleUrl}`;
                articles.push({
                    title,
                    url: fullUrl,
                    source: 'USA Today',
                    fetched_at: fetchTime
                });
            }
        }
    });

    for (const article of articles) {
        const response = await axios.get(article.url);
        const html = response.data;
        const $ = cheerio.load(html);

        const paragraphs = [];
        $('div.gnt_ar_b p').each(function () {
            paragraphs.push($(this).text());
        });

        article.text = paragraphs.join('\n');
    }

    return articles;
}

async function scrapeTechCrunch() {
    const articles = [];
    const response = await axios.get('https://techcrunch.com/tag/artificial-intelligence/');
    const html = response.data;
    const $ = cheerio.load(html);
    const fetchTime = new Date().toISOString();

    $('a').each(function () {
        const articleUrl = $(this).attr('href');

        if (articleUrl && (/-ai\b|ai-|ai-\b/.test(articleUrl))) {
            const title = $(this).text().trim();
            if (title && !articleUrl.includes("chatgpt")) {  // Ensure title is present and exclude ChatGPT
                const fullUrl = articleUrl.startsWith('http') ? articleUrl : `https://techcrunch.com${articleUrl}`;
                articles.push({
                    title,
                    url: fullUrl,
                    source: 'TechCrunch',
                    fetched_at: fetchTime
                });
            }
        }
    });

    for (const article of articles) {
        const response = await axios.get(article.url);
        const html = response.data;
        const $ = cheerio.load(html);

        const paragraphs = [];
        $('div.entry-content p').each(function () {
            paragraphs.push($(this).text());
        });

        article.text = paragraphs.join('\n');
    }

    // Remove duplicates based on URL
    const uniqueArticles = articles.reduce((acc, current) => {
        const x = acc.find(item => item.url === current.url);
        if (!x) {
            return acc.concat([current]);
        } else {
            return acc;
        }
    }, []);

    return uniqueArticles;
}

// Define individual endpoints for each source
app.get('/bbc', async (req, res) => {
    try {
        const articles = await scrapeBBC();
        res.json(articles.filter(article => article.title)); // Exclude articles with empty titles
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching BBC headlines' });
    }
});

app.get('/guardian', async (req, res) => {
    try {
        const articles = await scrapeGuardian();
        res.json(articles.filter(article => article.title)); // Exclude articles with empty titles
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching Guardian headlines' });
    }
});

app.get('/usatoday', async (req, res) => {
    try {
        const articles = await scrapeUSAToday();
        res.json(articles.filter(article => article.title)); // Exclude articles with empty titles
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching USA Today headlines' });
    }
});

app.get('/techcrunch', async (req, res) => {
    try {
        const articles = await scrapeTechCrunch();
        res.json(articles.filter(article => article.title)); // Exclude articles with empty titles
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching TechCrunch headlines' });
    }
});

app.get('/news', async (req, res) => {
    try {
        const [bbcArticles, guardianArticles, usaTodayArticles, techCrunchArticles] = await Promise.all([
            scrapeBBC(),
            scrapeGuardian(),
            scrapeUSAToday(),
            scrapeTechCrunch()
        ]);
        const articles = [...bbcArticles, ...guardianArticles, ...usaTodayArticles, ...techCrunchArticles]
            .filter(article => article.title); // Exclude articles with empty titles
        res.json(articles);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Error fetching headlines' });
    }
});

app.listen(PORT, () => console.log(`Server is running on ${PORT}`));
