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

  App.factory('Util', function() {

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

    return {
      exists : exists,
      dedupe : dedupe,
      parse : parse,
      sortByName : sortByName
    };
  });

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

    var obj = { categories: buildCategory('All'), words : {}, wordList : []};
    var allObjects = [];

    function buildCategory(name) {
      var obj = {
        name : name,
        children : {},
        childrenList : []
      };
      allObjects.push(obj);
      return obj;
    }

    obj.__promise = $http.get('data/words.csv').then(function(res) {

      Util.parse(res.data, '\n').forEach(function(row) {
        try {
          var subObj = obj.categories;
          var categories = Util.parse(row, ',');
          var word = {
            name : categories.pop(),
            categories : categories
          };

          categories.forEach(function(catName) {
            if (!subObj.categories.hasOwnProperty(catName)) {
              var newSub = buildCategory(catName);
              subObj.childrenList.push(newSub);
              subObj.children[catName] = newSub;
            }

            subObj = subObj.categories[catName];
          });

          if (!obj.words.hasOwnProperty(word.name)) {
            obj.words[word.name] = word;
            obj.wordList.push(word);
          } else { //Merge words
            var arr = obj.words[word.name].categories;
            arr.push.apply(arr, word.categories);
            Util.dedupe(arr);
          }
        } catch (e) {
          console.log(e); //Continue
        }
      });

      allObjects.forEach(function(o) {
        o.childrenList.sort(Util.sortByName);
      });

      obj.wordList.sort(Util.sortByName);
    });

    return obj;
  }]);

  App.controller('App', ['$scope', 'Words', 'TextToSpeech', 'PreloadTemplates', function($scope, Words, TextToSpeech, PreloadTemplates) {
    $scope.category = Words.categories;
    $scope.stack = [];
    $scope.sentence = [];
    $scope.words = Words.wordList;

    $scope.clear = function() {
      $scope.sentence = [];
    };

    $scope.speak = function() {
      TextToSpeech.speak($scope.sentence.join(' '));
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
      $('.words').css({ height : h - sentence });
    }

    $(window).on('resize', resize);
    resize();

    $('body').on('click', 'a', function(e) {
      setTimeout(function() {
        $('.words, .categories').scrollTop(0);
      }, 100);
    });
  });
})(jQuery, window);