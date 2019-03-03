let rp = require('request-promise'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  cfg = require('./tvvn.cfg.js'),
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
////////////////////////////////////////////////////////// FETCH CATEGORY /////////////////////////////////////////////
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

function fetchCategoriesByLetterAllPages(url, letter) {
  return fetchMaxPageNumberCategoriesByLetter(url, letter).then(pages => {
    log(url)
    log(letter)
    log(pages)
    return Promise.all(
      pages.map(page => {
        return fetchCategoriesByLetterOnePage(url, letter, page)
      })
    ).then(data => {
      let categories = [].concat(...data)
      // console.log(categories)
      writeFile(letter + '.txt', JSON.stringify(categories).toString())
      return categories
    })
  })
}
// Test fetch categories
// let url = cfg.tvvnCategoriesUrl,
// letter = 'T'
// fetchCategoriesByLetter(cfg.tvvnCategoriesUrl, 'T')
// fetchCategoriesByLetterAllPages(url, letter)

///////////////////////////////////////////// FETCH MAILS /////////////////////////////////////////////

// http://prntscr.com/msi39b
function getMails($) {
  var mails = []
  let elements = $('div .email_text')
  for (var i = 0; i < elements.length; i++) {
    var aTagHtml = elements
      .eq(i)
      .html()
      .trim()
    var aTag = cheerio.load(aTagHtml)('a')
    var title = aTag.attr('title').trim()
    if (title) mails.push(title)
  }
  //log(mails)
  return mails
}

async function fetchMailsByCategoryOnePageOfPlace(url, category, place, page) {
  url = url + category.id + '/' + encodeURI(category.name) + place
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
  //log($.html())
  return getMails($)
}
function fetchMailsByCategoryAllPagesOfPlace(url, category, place) {
  return fetchMaxPageMailByCatagoryOfPlace(url, category, place).then(pages => {
    log(pages)
    return Promise.all(
      pages.map(page => {
        return fetchMailsByCategoryOnePageOfPlace(url, category, place, page)
      })
    ).then(function(data) {
      let mails = [].concat(...data)
      log('Before filter mails.length=%s', mails.length)
      mails = [...new Set(mails)]
      log('After filter mails.length=%s', mails.length)
      //console.log(mails)
      writeFile(category.name + '.txt', mails.toString().replace(/,/g, '\r\n'))
      return mails
    })
  })
}

async function fetchMaxPageMailByCatagoryOfPlace(url, category, place) {
  url = url + category.id + '/' + encodeURI(category.name) + place
  log(url)
  //'https://trangvangvietnam.com/cateprovinces/127160/Kh%C3%A1ch%20S%E1%BA%A1n-%E1%BB%9F-t%E1%BA%A1i-tp.-h%E1%BB%93-ch%C3%AD-minh-%28tphcm%29'
  //'https://trangvangvietnam.com/cateprovinces/127160/Kh%C3%A1ch%20S%E1%BA%A1n-%E1%BB%9F-t%E1%BA%A1i-tp.-h%E1%BB%93-ch%C3%AD-minh-%28tphcm%29'
  //'https://trangvangvietnam.com/cateprovinces/127160/Kh%C3%A1ch%20S%E1%BA%A1n-%E1%BB%9F-t%E1%BA%A1i-tp.-h%E1%BB%93-ch%C3%AD-minh-%2528tphcm%2529
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
  log(maxPage)
  return Array.from({length: maxPage}, (_, i) => i + 1)
}
// Test fetch mails
// var tradeUrl = cfg.ttvnTradeUrl,
//   place = '-%E1%BB%9F-t%E1%BA%A1i-tp.-h%E1%BB%93-ch%C3%AD-minh-%28tphcm%29',
//   category = {
//     name: 'Khách Sạn',
//     id: '127160',
//   }
// fetchMailsByCategoryOnePageOfPlace(tradeUrl, category, place)
// fetchMaxPageMailByCatagoryOfPlace(tradeUrl, category, place)
// fetchMailsByCategoryAllPagesOfPlace(tradeUrl, category, place)

//////////////////////////////////// MAIN /////////////////////////////////
let letters = cfg.alphabet,
  url = cfg.tvvnCategoriesUrl,
  tradeUrl = cfg.ttvnTradeUrl,
  place = '-%E1%BB%9F-t%E1%BA%A1i-tp.-h%E1%BB%93-ch%C3%AD-minh-%28tphcm%29'

// fetchCategoriesByLetter(cfg.tvvnCategoriesUrl, 'T')
// fetchCategoriesByLetterAllPages(url, letter)
letters.forEach(async letter => {
  await fetchCategoriesByLetterAllPages(url, letter).then(categories => {
    log(categories)
    categories.forEach(async category => {
      await fetchMailsByCategoryAllPagesOfPlace(tradeUrl, category, place)
    })
  })
})
// function a() {
//   return Promise.all(
//     letters.map(async letter => {
//       return await fetchCategoriesByLetterAllPages(url, letter)
//     })
//   ).then(function(data) {
//     //log(data)
//     return data
//   })
// }
// a().then(b => {
//   log(b)
// })
