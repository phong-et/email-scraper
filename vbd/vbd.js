let rp = require('request-promise'),
  fs = require('fs'),
  cheerio = require('cheerio'),
  cfg = require('./vbd.cfg.js'),
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
///////////////////////// FETCH CATEGORY /////////////////////////
function getCategories($) {
  var categories = []
  let options = $('option')
  log(options.length)
  for (var i = 0; i < options.length; i++) {
    var id = 0,
      name = ''
    try {
      let option = options.eq(i)
      name = option.text().trim()
      id = option.attr('value').trim()
    } catch (err) {
      log(err)
    }
    if (name != '' && id !== '') {
      categories.push({name: name, id: id})
    }
  }
  log(categories)
  writeFile('categories.txt', JSON.stringify(categories).toString())
  return categories
}
async function fetchCategories(url) {
  var options = {
    url: url,
    headers: headers,
    transform: function(body) {
      return cheerio.load(body)
    },
  }
  let $ = await rp(options)
  var select = $('select[name="slt_industry"]').html()
  $ = cheerio.load(select)
  return getCategories($)
}
// Test
// fetchCategories(cfg.categoriesUrl)

///////////////////////// FETCH MAXPAGE CATEGORY /////////////////////////
async function fetchMaxPageNumberMailByCatagoryOfPlace(url, category, place) {
  try {
    var options = {
      url: url,
      method: 'POST',
      headers: headers,
      form: {
        txtkeyword: '',
        slt_industry: category.id,
        slt_province: place,
        btnsubmit: 'Tìm kiếm',
        txtMaNganh: '',
      },
      transform: function(body) {
        return cheerio.load(body)
      },
    }
    let $ = await rp(options)
    // calc next page
    let paging = $('.linfo').html()
    log(paging)
    let maxPage = paging.split(' c&#x1EE7;a ')[1]
    log(maxPage)
    return Array.from({length: maxPage}, (_, i) => i + 1)
  } catch (error) {
    log(error.message)
    appendFile('log.error.txt', JSON.stringify(category) + '\r\n')
  }
}
// TEST
// fetchMaxPageNumberMailByCatagoryOfPlace(cfg.tradeUrl, {name: 'Xây dựng - Dân dụng', id: 6970}, '02').then(a => {
//   log(a)
// })

///////////////////////// FETCH MAIL /////////////////////////
function getMails($) {
  var mails = []
  let elements = $('a')
  // log(elements.length)
  for (var i = 0; i < elements.length; i++) {
    let aTag = elements.eq(i)
    var href = aTag.attr('href')
    var text = aTag.text()
    // log(href)
    if (href && href.indexOf('mailto:') > -1 && validateEmail(text)) mails.push(text)
  }
  // log(mails)
  return mails
}
function validateEmail(email) {
  var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  return re.test(String(email).toLowerCase())
}
async function delay(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}
function random() {
  var items = Array(1111, 1234, 2000, 500, 1210, 1321, 1000, 2134, 111, 555, 777, 888, 999)
  item = items[Math.floor(Math.random() * items.length)]
  //log(item)
  return item
}
async function fetchMailsByCategoryOnePageOfPlace(url, category, place, page) {
  var options = {
    url: url,
    method: 'POST',
    headers: headers,
    form: {
      txtkeyword: '',
      slt_industry: category.id,
      slt_province: place,
      btnsubmit: 'Tìm kiếm',
      txtMaNganh: '',
      AbsolutePage: page,
    },
    transform: function(body) {
      return cheerio.load(body)
    },
  }
  let $ = await rp(options)
  return getMails($)
}
// Test
//fetchMailsByCategoryOnePageOfPlace(cfg.tradeUrl, {name: 'Xây dựng - Dân dụng', id: 6970}, '02', 1)
async function fetchMailsByCategoryAllPagesOfPlace(url, category, place, limittedPage) {
  try {
    return await fetchMaxPageNumberMailByCatagoryOfPlace(url, category, place).then(async pages => {
      log(JSON.stringify(category))
      log(pages)
      let mails = []
      if (limittedPage) pages.length = limittedPage
      for (let i = 0; i < pages.length; i++) {
        await delay(random())
        let mail = await fetchMailsByCategoryOnePageOfPlace(url, category, place, pages[i])
        mails.push(mail)
        log(mail)
      }
      //log('Done')
      //log(mails)
      mails = [].concat(...mails)
      log('[Category] Before filter mails.length=%s', mails.length)
      mails = [...new Set(mails)]
      log('[Category] After filter mails.length=%s', mails.length)
      writeFile(category.name + '.txt', mails.toString().replace(/,/g, '\r\n'))
      return mails
    })
  } catch (error) {
    log(error)
    appendFile('log.error.txt', JSON.stringify(category) + '\r\n')
  }
}

fetchMailsByCategoryAllPagesOfPlace(cfg.tradeUrl, {name: 'Xây dựng - Dân dụng', id: 6970}, '02', 3).then(m => {
  log(m)
})
