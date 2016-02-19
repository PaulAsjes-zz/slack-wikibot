'use strict';

const Bot = require('./Bot');
const request = require('superagent');

const wikiAPI = 'https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts&exintro=&explaintext=&titles=';
const wikiURL = 'https://en.wikipedia.org/wiki/';

const udURL = 'http://api.urbandictionary.com/v0/define?term=';

const bot = new Bot({
  token: process.env.SLACK_TOKEN,
  autoReconnect: true,
  autoMark: true
});

bot.respondTo('hello', (message, channel, user) => {
  channel.send(`Hello to you too, ${user.name}!`)
}, true);

// Take the message text and return the arguments
function getArgs(msg) {
  return msg.split(' ').slice(1);
}

function getWikiSummary(term, cb) {
  // replace spaces with unicode
  let parameters = term.replace(/ /g, '%20');

  request
    .get(wikiAPI + parameters)
    .end((err, res) => {
      if (err) {
        cb(err);
        return;
      }

      let url = wikiURL + parameters;

      cb(null, JSON.parse(res.text), url);
    });
}

function getUrbanDictionaryDefinition(term, cb) {
  let parameters = term.replace(/ /g, '%20');

 request
  .get(udURL + parameters)
  .end((err, res) => {
    if (err) {
      cb(err);
      return;
    }

    let data = JSON.parse(res.text);
    let url = data.list[0].permalink;

    cb(null, data, url);
  })
}

bot.respondTo('help', (message, channel) => {
  channel.send(`To use my Wikipedia functionality, type \`wiki\` followed by your search query`);
  channel.send(`To use my Urban Dictionary functionality, type \`dic\` followed by your search query`);
}, true);

bot.respondTo('dic', (message, channel, user) => {
  if (user && user.is_bot) {
    return;
  }

  let args = getArgs(message.text).join(' ');

  bot.setTypingIndicator(message.channel);

  getUrbanDictionaryDefinition(args, (err, result, url) => {
    if (err) {
      channel.send(`I\'m sorry, but something went wrong with your query`);
      console.error(err);
      return;
    }

    if (result.result_type === 'no_results') {
      channel.send('Sorry, no results found for that term');
      return;
    }

    let definition = result.list[0].definition;
    let example = result.list[0].example;

    let definitionParagraphs = definition.replace(/\r/, '').split('\n');
    let exampleParagraphs = example.replace(/\r/, '').split('\n');

    channel.send(url);

    channel.send('*Definition:*');
    definitionParagraphs.forEach((paragraph) => {
      if (paragraph !== '') {
        channel.send(`> ${paragraph}`);
      }
    });

    channel.send('*Example:*');
    exampleParagraphs.forEach((paragraph) => {
      if (paragraph !== '') {
        channel.send(`> ${paragraph}`);
      }
    });

    channel.send('*Sounds like:*');
    channel.send(result.sounds[0]);
  });
}, true);

bot.respondTo('wiki', (message, channel, user) => {
  if (user && user.is_bot) {
    return;
  }

  // grab the search parameters, but remove the command 'wiki' from the beginning
  // of the message first
  let args = getArgs(message.text).join(' ');

  // if there are no arguments, return
  if (args.length < 1) {
    channel.send('I\'m sorry, but you need to provide a search query!');
    return;
  }

  // set the typing indicator before we start the wikimedia request
  // the typing indicator will be removed once a message is sent
  bot.setTypingIndicator(message.channel);

  getWikiSummary(args, (err, result, url) => {
    if (err) {
      channel.send(`I\'m sorry, but something went wrong with your query`);
      console.error(err);
      return;
    }

    let pageID = Object.keys(result.query.pages)[0];

    // -1 indicates that the article doesn't exist
    if (parseInt(pageID, 10) === -1) {
      channel.send('That page does not exist yet, perhaps you\'d like to create it:');
      channel.send(url);
      return;
    }

    let page = result.query.pages[pageID];
    let summary = page.extract;

    if (/may refer to/i.test(summary)) {
      channel.send('Your search query may refer to multiple things, please be more specific or visit:');
      channel.send(url);
      return;
    }

    if (summary !== '') {
      channel.send(url);

      let paragraphs = summary.split('\n');

      paragraphs.forEach((paragraph) => {
        if (paragraph !== '') {
          channel.send(`> ${paragraph}`);
        }
      });
    } else {
      channel.send('I\'m sorry, I couldn\'t find anything on that subject. Try another one!');
    }
  });
}, true);
