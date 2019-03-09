let rp = require('request-promise'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  cfg = require('./tvvn.cfg.js'),
  log = console.log,
  headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.8; rv:24.0) Gecko/20100101 Firefox/24.0',
  }
function writeFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile('mails/' + fileName.replace(/[/\\?%*:|"<>]/g, '-'), content, function(err) {
      if (err) reject(err)
      var statusText = 'write file > ' + fileName.replace(/[/\\?%*:|"<>]/g, '-') + ' success'
      //log(statusText)
      resolve(statusText)
    })
  })
}
function appendFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.appendFile(fileName, content, function(err) {
      if (err) reject(err)
      var statusText = 'write file > ' + fileName + ' success'
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
async function fetchCategoriesByLetterAllPages(url, letter) {
  return await fetchMaxPageNumberCategoriesByLetter(url, letter).then(async pages => {
    log(url)
    log(letter)
    log(pages)
    return await Promise.all(
      pages.map(async page => {
        return await fetchCategoriesByLetterOnePage(url, letter, page)
      })
    ).then(async data => {
      let categories = [].concat(...data)
      // console.log(categories)
      await writeFile(letter + '.txt', JSON.stringify(categories).toString())
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
// ===> Promise all
// async function fetchMailsByCategoryAllPagesOfPlace(url, category, place) {
//   return await fetchMaxPageNumberMailByCatagoryOfPlace(url, category, place).then(async pages => {
//     log(category)
//     log(pages)
//     return await Promise.all(
//       pages.map(async page => {
//         setTimeout(async () => {
//           return await fetchMailsByCategoryOnePageOfPlace(url, category, place, page)
//         }, 1000)
//       })
//     ).then(async data => {
//       let mails = [].concat(...data)
//       //log('Before filter mails.length=%s', mails.length)
//       mails = [...new Set(mails)]
//       //log('After filter mails.length=%s', mails.length)
//       //console.log(mails)
//       await writeFile(category.name + '.txt', mails.toString().replace(/,/g, '\r\n'))
//       return mails
//     })
//   })
// }
// ===> for & delay is better
async function fetchMailsByCategoryAllPagesOfPlace(url, category, place) {
  try {
    return await fetchMaxPageNumberMailByCatagoryOfPlace(url, category, place).then(async pages => {
      log(JSON.stringify(category))
      log(pages)
      let mails = []
      for (let i = 0; i < pages.length; i++) {
        await delay(2000)
        let mail = await fetchMailsByCategoryOnePageOfPlace(url, category, place, pages[i])
        mails.push(mail)
        //log(mail)
      }
      //log('Done')
      //log(mails)
      mails = [].concat(...mails)
      //log('[Category] Before filter mails.length=%s', mails.length)
      mails = [...new Set(mails)]
      //log('[Category] After filter mails.length=%s', mails.length)
      await writeFile(category.name + '.txt', mails.toString().replace(/,/g, '\r\n'))
      return mails
    })
  } catch (error) {
    log(error)
    appendFile('log.error.txt', JSON.stringify(category) + '\r\n')
  }
}
async function fetchMaxPageNumberMailByCatagoryOfPlace(url, category, place) {
  try {
    url = url + category.id + '/' + encodeURI(category.name) + place
    //log(url)
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
    // log(maxPage)
    return Array.from({length: maxPage}, (_, i) => i + 1)
  } catch (error) {
    log(error.message)
    appendFile('log.error.txt', JSON.stringify(category) + '\r\n')
  }
}
// Test fetch mails
// var tradeUrl = cfg.ttvnTradeUrl,
//   place = '-%E1%BB%9F-t%E1%BA%A1i-tp.-h%E1%BB%93-ch%C3%AD-minh-%28tphcm%29',
//   category = {
//     name: 'Khách Sạn',
//     id: '127160-0',
//   }
// fetchMailsByCategoryOnePageOfPlace(tradeUrl, category, place)
// fetchMaxPageNumberMailByCatagoryOfPlace(tradeUrl, category, place)
// fetchMailsByCategoryAllPagesOfPlace(tradeUrl, category, place)

//////////////////////////////////// MAIN /////////////////////////////////
let letters = cfg.alphabet,
  url = cfg.tvvnCategoriesUrl,
  tradeUrl = cfg.ttvnTradeUrl,
  place = '-%E1%BB%9F-t%E1%BA%A1i-tp.-h%E1%BB%93-ch%C3%AD-minh-%28tphcm%29'

// fetchCategoriesByLetter(cfg.tvvnCategoriesUrl, 'T')
// fetchCategoriesByLetterAllPages(url, letter)

//////////////////////////////////// PROMISE.ALL //////////////////////////////////
// letters.forEach(async letter => {
//   await fetchCategoriesByLetterAllPages(url, letter).then(async categories => {
//     log('categories.length:%s', categories.length)
//     log(categories)
//     // categories.forEach(async category => {
//     //   await fetchMailsByCategoryAllPagesOfPlace(tradeUrl, category, place)
//     // })
//     return await Promise.all(
//       categories.map(async category => {
//         return await fetchMailsByCategoryAllPagesOfPlace(tradeUrl, category, place)
//       })
//     ).then(async data => {
//       let mails = [].concat(...data)
//       log('Before filter mails.length=%s', mails.length)
//       mails = [...new Set(mails)]
//       log('After filter mails.length=%s', mails.length)
//       //console.log(mails)
//       await writeFile(letter + '_All_Mails.txt', mails.toString().replace(/,/g, '\r\n'))
//     })
//   })
// })

//////////////////////////////////// FOR & DELAY //////////////////////////////////
async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}
function random(){
  var items = Array(1111,1234,2000,500,3210,4321,1000,2134,111,555,777,888,999);
  item = items[Math.floor(Math.random()*items.length)];
  //log(item)
  return item
}
async function fetchMailsByLetter(letter) {
  let categories = await fetchCategoriesByLetterAllPages(url, letter)
  // log(categories)
  let mails = []
  for (let i = 0; i < categories.length; i++) {
    await delay(random())
    let mail = await fetchMailsByCategoryAllPagesOfPlace(tradeUrl, categories[i], place)
    mails.push(mail)
    //log(mail)
  }
  //log('Done')
  //log(mails)
  mails = [].concat(...mails)
  log('[%s] Before filter mails.length=%s', letter, mails.length)
  mails = [...new Set(mails)]
  log('[%s] After filter mails.length=%s', letter, mails.length)
  await writeFile(letter + '_All_Mails.txt', mails.toString().replace(/,/g, '\r\n'))
}
// fetchMailsByLetter('A')
async function fetchMailsByLetters() {
  for (let i = 0; i < letters.length; i++) {
    delay(random())
    await fetchMailsByLetter(letters[i])
  }
}
fetchMailsByLetters()
