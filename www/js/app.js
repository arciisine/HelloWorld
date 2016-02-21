"use strict";

(function() {
  var App = angular.module("HelloWorld", ['ng', 'ngRoute', 'ngAnimate']);

  App.config(['$routeProvider', function($routeProvider) {

    $routeProvider
      .when('/', {
        templateUrl : 'html/build.html',
        resolve : {
          data : ['Words', function(Words) {
            return Words.__promise;
          }]
        }
      });
  }]);

  App.factory('Util', ['$window', function($window) {

    var id = 0

    function exists(x) { return !!x; }

    function dedupe(arr) {
      arr.sort();
      for (var i = 1; i < arr.length; i++) {
        if (arr[i] === arr[i-1]) {
          arr.splice(i, 1);
          i -= 1; //Redo
        }
      }
      return arr;
    }

    function parse(data, sep) {
      return data.split(sep).map($.trim).filter(exists);
    }

    function sortByName(a,b) {
      return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
    }

    function processWord(o, row) {

      var name = row.pop();
      var word = {
        _id : id++,
        name : name,
        categories: row,
        safe : name.replace(/[^A-Za-z]/g, '_').toLowerCase()
      };

      if (!o.words[name]) {
        o.words[name] = word;
        o.wordList.push(word);
      } else { //Merge words
        var arr = o.words[name].categories;
        arr.push.apply(arr, row);
        dedupe(arr);
      }

      return word;
    }

    function processCategory(o, name) {
      if (!o.children[name]) {
        var newSub = buildCategory(name);
        o.childrenList.push(newSub);
        o.children[name] = newSub;
      }

      return o.children[name];
    }

    function buildCategory(name) {
      var obj = {
        _id : id++,
        name : name,
        children : {},
        childrenList : []
      };

      return obj;
    }

    function getValue(v, k) {
      return v;
    }

    function buildNamedList(o) {
      var l = $.map(o, getValue);
     return l.sort(sortByName);
    }

    return {
      exists : exists,
      dedupe : dedupe,
      parse : parse,
      sortByName : sortByName,
      buildCategory : buildCategory,
      processWord : processWord,
      processCategory : processCategory,
      getValue : getValue,
      buildNamedList : buildNamedList
    };
  }]);

  App.service('PreloadTemplates', ['$templateCache', '$window', function($templateCache, $window) {
    if ($window.preloadTemplates) {
      $window.preloadTemplates($templateCache.put);
    }
  }]);

  App.factory('TextToSpeech', ['$window', function($window) {
    var voice = null;
    var lang = "en-US";

    var svc = {
      speak : function (text, speed) {

        function chooseVoice(synth) {
          voice = synth.getVoices().filter(function(v) {
            return v.lang == lang && v.localService === true;
          }).shift();
          svc.speak(text, speed);
        }

        speed = speed || .7;

        if ($window.SpeechSynthesisUtterance && $window.speechSynthesis) {
          if (voice == null) {
            if ($window.speechSynthesis.getVoices().length) {
              chooseVoice($window.speechSynthesis);
            } else {
              $window.speechSynthesis.onvoiceschanged = function() { chooseVoice(this); };
            }
            return;
          }

          var u = new $window.SpeechSynthesisUtterance(text);

          if (lang) {
            u.lang = lang;
          }

          if (voice) {
            u.voice = voice;
          }
          if (speed) {
            u.rate = speed;
          }
          $window.speechSynthesis.speak(u);
        } else if ($window.navigator.tts) {
          if (speed) {
            $window.navigator.tts.speed(speed * 100.0, function(){}, function(e) {
              $window.alert(e);
            });
          }
          $window.navigator.tts.speak(text, function(){}, function(e) {
            $window.alert(e);
          });
        }
      }
    };

    return svc;
  }]);

  App.factory('Words', ['$http', 'Util', function($http, Util) {

    var obj = {
      categories: Util.buildCategory('All'),
      words : {},
      categoryNames : {'All':'All'},
      wordList : []
    };

    obj.__promise = $http.get('data/words.csv').then(function(res) {
      Util.parse(res.data, '\n').forEach(function(row, i) {
        if (i === 0) return;
        var sub =  obj.categories;

        try {
          var word = Util.processWord(obj, Util.parse(row, ','));

          word.categories.forEach(function(name) {
            obj.categoryNames[name] = name;
            sub = Util.processCategory(sub, name);
          });

        } catch (e) {
          console.log(e); //Continue
        }
      });

      obj.wordList.forEach(function(v) {
        v.categories.unshift(obj.categories.name);
      });
    });

    return obj;
  }]);

  App.controller('App', ['$scope', 'Words', 'TextToSpeech', 'PreloadTemplates', function($scope, Words, TextToSpeech, PreloadTemplates) {
    $scope.category = Words.categories;
    $scope.stack = [];
    $scope.sentence = [];
    $scope.wordList = Words.wordList;

    $scope.clear = function() {
      $scope.sentence = [];
    };

    $scope.speak = function() {
      var sentence = $scope.sentence.map(function(v) { return v.alt || v.name; }).join('. ');
      TextToSpeech.speak(sentence);
    };

    $scope.pickCategory = function(category) {
      $scope.stack.push($scope.category);
      $scope.category = category || [];
    };

    $scope.pickWord = function(word) {
      $scope.sentence.push(word);
      if ($scope.stack.length) {
        $scope.category = $scope.stack[0];
        $scope.stack = [];
      }
    };

    $scope.popCategory = function() {
      $scope.category = $scope.stack.pop();
    };
  }]);
})();

(function($, window) {
  $(function() {
    function resize() {
      var h = $(window).height();
      var w = $(window).width();

      $('body,html').css({ width : ''+w+'px', height: ''+h+'px' });
      var sentence = $('.sentence').height();
      var lowerHeight = h - sentence;
      var catWidth = $('.categories').width();
      $('.words, .categories, .words .scrollable').css({ height :  lowerHeight });
      $('.words').css({ width : w - catWidth - 30 /* margin */});
      var $cat = $('.categories');
      $cat.find('.scrollable').css({
        height : lowerHeight - $cat.find('.scroll-header').height()
      });
    }

    function onAction() {
      var $words = $('.words');
      var cat = $words.attr('category')  ;
      if (cat !== 'All') {
        $('.scrollable').css({ 'overflow-y' : 'hidden' });
        $('.scrollable').scrollTop(0);
        $('.scrollable').css({ 'overflow-y' : 'scroll' });
      }
      $('a:not(.'+cat+'):visible', $words).hide();
      $('a.'+cat+':hidden', $words).show();

      resize();
    }

    $(window).on('resize', resize);

    $('body').on('mouseup', 'a', function(e) {
      setTimeout(onAction, 1);
    });

    setTimeout(onAction, 100);
  });
})(jQuery, window);