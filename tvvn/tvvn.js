let rp = require('request-promise'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  cfg = require('./tvvn.cfg'),
  log = console.log,
  headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
  }
async function writeFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, function(err) {
      if (err) reject(err)
      var statusText = 'write file > ' + fileName + ' success'
      log(statusText)
      resolve(statusText)
    })
  })
}
async function appendFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.appendFile(fileName, content, function(err) {
      if (err) reject(err)
      var statusText = 'append file > ' + fileName + ' success'
      log(statusText)
      resolve(statusText)
    })
  })
}
function getCategories($) {
  var categories = []
  let elements = $('p').attr('style', 'font-size:15px')
  for (var i = 0; i < elements.length; i++) {
    var aTagHtml = elements
      .eq(i)
      .html()
      .trim()
    var aTag = cheerio.load(aTagHtml)('a')
    var name = aTag
      .text()
      .trim()
      .replace(/,/g, ' -')
    var href = aTag.attr('href')
    var id = 0
    try {
      if (href != '' && href != undefined) id = href.match(/\d+/)[0]
    } catch (err) {
      log(err)
    }
    if (name != '') {
      categories.push({name: name, id: id})
    }
  }
  // log(categories)
  return categories
}

async function fetchCategoriesByLetterOnePage(url, letter, page) {
  var url = url + letter
  // miss page param will fetch 1st page
  if (page !== undefined) url += '?page=' + page
  var options = {
    url: url,
    headers: headers,
    transform: function(body) {
      return cheerio.load(body)
    },
  }
  let $ = await rp(options)
  var html = $('#khung_subpages > div')
    .eq(2)
    .eq(0)
    .html()
  // log(html)
  $ = cheerio.load(html)
  html = $('div')
    .attr('style', 'height:23px; padding-left:21px; margin-bottom:8px')
    .html()
  // log(html)
  $ = cheerio.load(html)
  // await writeFile(letter + '.txt', JSON.stringify(categoriesOfLetter).toString())
  return getCategories($)
}
async function fetchMaxPageNumberCategoriesByLetter(url, letter) {
  var url = url + letter
  var options = {
    url: url,
    headers: headers,
    transform: function(body) {
      return cheerio.load(body)
    },
  }
  let $ = await rp(options)
  // calc next page
  let paging = $('#paging a')
  let maxPage = paging
    .eq(paging.length - 2)
    .text()
    .trim()
  // log(maxPage)
  return Array.from({length: maxPage}, (_, i) => i + 1)
}
let url = cfg.tvvnCategoriesUrl,
  letter = 'T'
// fetchCategoriesByLetter(cfg.tvvnCategoriesUrl, 'T')
function fetchCategoriesByLetterAllPages(url, letter) {
  fetchMaxPageNumberCategoriesByLetter(url, letter).then(pages => {
    log(pages)
    return Promise.all(
      pages.map(page => {
        return fetchCategoriesByLetterOnePage(url, letter, page)
      })
    ).then(function(data) {
      let categories = [].concat(...data)
      console.log(categories)
      writeFile(letter + '.txt', JSON.stringify(categories).toString())
      return categories
    })
  })
}


fetchCategoriesByLetterAllPages(url, letter)
