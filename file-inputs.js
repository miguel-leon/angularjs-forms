/**
 * File Inputs library.
 * Support for ngModel in file inputs, directive for handling file loading and bootstrap styling.
 * @author Miguel Leon
 * @year 2016
 */
(function () {
	'use strict';

	angular.module('file-inputs', [])

	.constant('InputFileTemplate',
	'<div class="file-container input-group">' +
	'<div class="input-group-btn">' +
	'<label class="btn btn-default" title="Seleccionar archivo">' +
	'<i class="fa fa-folder-open"></i>Buscar...' +
	'</label>' +
	'</div>' +
	'<div class="input-group-addon file-display"></div>' +
	'</div>')

	.directive('input', function (InputFileTemplate) {
		return {
			priority: 5,
			link: {
				pre: function (scope, iElement, iAttrs) {
					if (iAttrs.type !== 'file') {
						return;
					}

					var template = angular.element(InputFileTemplate);

					iElement.after(template);
					var tWrap = template.find('label');
					var tDisplay = template.find('.file-display');

					tWrap.append(iElement);

					iElement.change(scope.$apply.bind(scope));

					scope.$watchCollection(function () {
						return iElement[0].files;
					}, function (files) {
						var text = getDefaultDisplayText(files);
						tDisplay.text(text);
						tDisplay.attr('title', text);
					});

					scope.$watch(function () {
						return !!iAttrs.disabled;
					}, function (value) {
						tWrap.attr('disabled', value);
					});

					scope.$on('$destroy', function () {
						iElement.off('change');
					});
				}
			}
		};

		function getDefaultDisplayText(files) {
			return files.length ?
			(files.length === 1 ? files.item(0).name : files.length + ' archivos')
			: '';
		}
	})


	.directive('ngModel', function ($timeout) {
		return {
			require: 'ngModel',
			link: function (scope, iElement, iAttrs, ngModel) {
				if (iAttrs.type === 'file') {
					iElement.change(function () {
						ngModel.$setTouched();
						ngModel.$setViewValue(iElement[0].files.length ? iElement[0].files : null);
					});

					scope.$watch(iAttrs.ngModel, function (value) {
						if (angular.isDefined(value)) {
							if (!(value instanceof FileList)) {
								iElement.val('');
							}
							// Optional. Only works on chrome
							else {
								if (value !== iElement[0].files) {
									// Workaround but dubious code.
									$timeout(function () {
										// The following assignment somehow triggers an event that calls $apply again.
										// Raise errors if the element is reentering, like with ngIf e.g.
										iElement[0].files = value;
									}, 0);
								}
							}
						}
					});

					scope.$on('$destroy', function () {
						iElement.off('change');
					});
				}
			}
		};
	})

	.constant('UiFileTemplates', {
		loading: '<div class="input-group-btn">' +
		'<button class="btn btn-warning" ui-icon="ban" ng-click="clearFile(true)">Cancelar</button>' +
		'</div>' +
		'<div class="input-group-addon file-display progress">' +
		'<div class="progress-bar progress-bar-striped active" style="width: 100%">' +
		'<span title="{{:: model.item(0).name }}">{{:: model.item(0).name }}</span>' +
		'</div>' +
		'</div>',

		loaded: '<div class="input-group-btn">' +
		'<button class="btn btn-danger" ui-icon="trash" ng-click="clearFile()" ng-disabled="isDisabled()">Eliminar</button>' +
		'</div>' +
		'<div class="input-group-addon file-display">' +
		'<a ng-click="showFile()" title="{{:: getFileName() }}">{{:: getFileName() }}</a>' +
		'</div>'
	})

	.provider('uiFile', function () {
		var service = {
			handleFile: function (file) {
				return file.name;
			},

			cancelHandle: function () {},

			showFile: function () {},

			getFileName: function (file) {
				return file;
			}
		};

		uiFileFactory.$inject = [];

		this.setService = function (custom) {
			uiFileFactory.$inject = [custom];
		};

		this.$get = uiFileFactory;

		function uiFileFactory(custom) {
			return custom ? angular.extend(Object.create(service), custom) : service;
		}
	})


	.directive('uiFile', function ($compile, $q, $timeout, UiFileTemplates, uiFile) {
		initPrototypes();

		return {
			require: 'ngModel',
			scope: {
				model: '=ngModel'
			},
			link: function (scope, iElement, iAttrs, ngModelCtrl) {
				var container = iElement.parents('.file-container');

				var faces = {
					default: new DefaultFace(container.contents()),
					loading: new Face(UiFileTemplates.loading),
					loaded: new Face(UiFileTemplates.loaded)
				};

				var currentFace = faces.default;
				var pendingPromise = null;

				var onLoad = iAttrs.onLoad ?
				function (filelist) {
					return function (value) {
						// Wait for angular to assign model to original ngModel in the parent scope.
						// scope.$evalAsync does not work for this.
						$timeout(function () {
							scope.$parent.$eval(iAttrs.onLoad, {
								$filelist: filelist,
								$file: filelist[0],
								$value: value
							});
						});
					};
				} :
				angular.noop;

				function switchFace(face) {
					if (currentFace !== face) {
						currentFace.leave();
						(currentFace = face).enter(container, scope);
					}
				}

				function loadingValidity(isValid) {
					ngModelCtrl.$setValidity('loading', isValid);
				}

				scope.$watch('model', function (modelValue) {
					if (!modelValue) {
						switchFace(faces.default);
					}
					else if (modelValue instanceof FileList) {
						switchFace(faces.loading);
						loadingValidity(false);

						var promise = (pendingPromise = uiFile.handleFile(modelValue.item(0)));
						$q.when(promise)
						.catch(function () {
							return null;
						})
						.then(function (value) {
							if (promise === pendingPromise) {
								scope.model = value;
								loadingValidity(true);
								if (value) return value;
							}
							return $q.reject();
						})
						.then(onLoad(modelValue));
					}
					else {
						switchFace(faces.loaded);
					}
				});

				scope.isDisabled = function () {
					return !!iAttrs.disabled;
				};
				scope.clearFile = function (cancel) {
					scope.model = null;
					if (cancel) {
						uiFile.cancelHandle(pendingPromise);
						pendingPromise = null;
						loadingValidity(true);
					}
				};
				scope.showFile = function () {
					uiFile.showFile(scope.model);
				};
				scope.getFileName = function () {
					return scope.model ? uiFile.getFileName(scope.model) : '';
				};
			}
		};

		function Face(template) {
			this.$compiled = $compile(template);
		}

		function DefaultFace(element) {
			this.$element = element;
		}

		function initPrototypes() {
			Face.prototype.leave = function () {
				this.$element.remove();
				this.$element = null;
			};

			Face.prototype.enter = function (container, scope) {
				this.$element = this.$compiled(scope, function (clone) {
					container.append(clone);
				});
			};

			DefaultFace.prototype.leave = function () {
				this.$element.detach();
			};

			DefaultFace.prototype.enter = function (container) {
				container.append(this.$element);
			};
		}
	});
})();
