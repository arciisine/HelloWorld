"use strict";

var App = angular.module("HelloWorld", ['ng', 'ngRoute', 'ngAnimate']);

App.config(['$routeProvider', function($routeProvider) {

  $routeProvider
    .when('/', {
      templateUrl : 'html/build.html',
      resolve : ['Words', function(Words) {
        return Words.__promise;
      }]
    });
}]);

App.factory('TextToSpeech', ['$window', function($window) {
  return {
    speak : function (text, speed) {
      if ($window.SpeechSynthesisUtterance && $window.speechSynthesis) {
        var u = new $window.SpeechSynthesisUtterance(text);
        $window.speechSynthesis.speak(u);
      } else if ($window.navigator.tts) {
        $window.navigator.tts.speed(speed);
        $window.navigator.tts.speak(text);
      }
    }
  };
}]);

App.factory('Words', ['$http', function($http) {

  var obj = {categories:{}, children:[], categoryNames : [], allChildren : []};

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

  obj.__promise = $http.get('data/words.csv').then(function(res) {
    var rows = res.data.split('\n');
    var allObjects = [obj];

    for (var j = 1; j < rows.length; j++) {

      try {
        var row = rows[j];
        var categories = row.split(',');
        var name = categories.pop();
        var category = null;
        var nextPart = true;
        var subObj = obj;
        var stack = [];

        for (var i = 0; i < categories.length && nextPart; i++) {

          category = $.trim(categories[i]);
          nextPart = categories[i+1];

          if (!subObj.categories.hasOwnProperty(category)) {
            var newSub = {categories:{}, children:[], allChildren : [], categoryNames : []};
            allObjects.push(newSub);

            subObj.categoryNames.push(category);
            subObj.categories[category] = newSub;
          }

          stack.push(subObj);

          subObj = subObj.categories[category];
        }

        stack.push(subObj);

        angular.forEach(stack, function(o) {
          o.allChildren.push(name);
        });

        subObj.children.push(name);

      } catch (e) {
        console.log(e); //Continue
      }
    }

    angular.forEach(allObjects, function(o) {
      o.categoryNames.sort();
      o.allChildren = dedupe(o.allChildren);
    })
  });

  return obj;
}]);

App.controller('App', ['$scope', 'Words', 'TextToSpeech', function($scope, Words, TextToSpeech) {
  $scope.category = Words;
  $scope.stack = [];
  $scope.sentence = [];

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

$(function() {
  function resize() {
    var h = $(window).height();
    var w = $(window).width();

    $('body,html').css({ width : ''+w+'px', height: ''+h+'px' });
  }

  setTimeout(resize, 100);

  $(window).on('resize', resize);
});