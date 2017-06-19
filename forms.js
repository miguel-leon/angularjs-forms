/**
 * Forms. Form validation and form bootstrap styling library.
 * @author Miguel Leon
 * @year 2016
 */
(function () {
	'use strict';

	angular.module('forms', [])

	.constant('templater', {
		addColumnWidthClass: function (element, value) {
			element.addClass('col-sm-{0}'.interpolate(value));
		},
		addColumnOffsetClass: function (element, value) {
			element.addClass('col-sm-offset-{0}'.interpolate(value));
		},
		createColumnWidthWrapper: function (value) {
			return angular.element('<div class="col-sm-{0}"></div>'.interpolate(value));
		}
	})

	.constant('formsTemplater', {
		selectorsForClassFormControl: [
			'select',
			'textarea',
			'input[type=text]',
			'input[type=password]',
			'input[type=number]',
			'input[type=date]',
			'input[type=email]',
			'input[type=tel]'
		],
		formGroupClass: 'form-group',
		controlLabelClass: 'control-label',
		formControlClass: 'form-control',
		formHorizontalClass: 'form-horizontal',
		helpBlockClass: 'help-block',
		hasErrorClass: 'has-error'
	})


	.directive('form', function () {
		return {
			compile: function (tElement) {
				tElement.attr('novalidate', '');
			}
		};
	})


	.directive('formGroup', function (templater, formsTemplater) {
		return {
			compile: function (tElement, tAttrs) {
				tElement.addClass(formsTemplater.formGroupClass);

				if (tAttrs.formGroup) {
					templater.addColumnWidthClass(tElement, tAttrs.formGroup);
				}

				if (tAttrs.label) {
					tElement.prepend('<label>{0}</label>'.interpolate(tAttrs.label));
				}

				var tLabel = tElement.find('label');
				if (tLabel.length) {
					tLabel.addClass(formsTemplater.controlLabelClass);

					var tField = tElement.find('[ng-model]:first');
					if (tField.length && tField.attr('id')) {
						// Possible required interpolation added automatically after this phase by Angular compiler.
						tLabel.attr('for', tField.attr('id'));
					}
				}

				tElement.find(formsTemplater.selectorsForClassFormControl.join(','))
				.addClass(formsTemplater.formControlClass);
			}
		};
	})

	.constant('formHorizontalConfig', {
		leftWidth: 2,
		rightWidth: 10
	})

	.directive('formHorizontal', function (templater, formsTemplater, formHorizontalConfig) {
		return {
			// After all inner nodes have compiled.
			link: function (scope, tElement, tAttrs) {
				tElement.addClass(formsTemplater.formHorizontalClass);

				var values = tAttrs.formHorizontal && tAttrs.formHorizontal.trim().split(/\s*,\s*/);
				var leftWidth = values[0] || formHorizontalConfig.leftWidth;
				var rightWidth = values[1] || formHorizontalConfig.rightWidth;

				angular.forEach(tElement.find('.' + formsTemplater.formGroupClass), function (tFormGroup) {
					tFormGroup = angular.element(tFormGroup);
					var tWrapper = templater.createColumnWidthWrapper(rightWidth);
					// jQuery wrap remove event bindings. Double append required.
					tWrapper.append(tFormGroup.contents());
					tFormGroup.append(tWrapper);
					var tLabel = tWrapper.children('.{0}:first'.interpolate(formsTemplater.controlLabelClass));
					if (tLabel.length) {
						templater.addColumnWidthClass(tLabel, leftWidth);
						tFormGroup.prepend(tLabel);
					}
					else {
						templater.addColumnOffsetClass(tWrapper, leftWidth);
					}
				});
			}
		};
	})

	.directive('validate', function (ngClassDirective, formsTemplater) {
		return {
			restrict: 'A',
			require: ['validate', '?^form'],
			link: function (scope, iElement, iAttrs, controllers) {
				var validateCtrl = controllers[0];
				var formCtrl = controllers[1];
				var ngModel = validateCtrl.ngModelController();

				if (!ngModel) {
					throw new Error('A field with ngModel is required for directive validate in element:\n' +
					iElement[0].outerHTML);
				}

				scope = scope.$new();
				scope.showValidation = validateCtrl.showValidation = function () {
					return ngModel.$touched || (formCtrl && formCtrl.$submitted);
				};

				scope.fieldHasError = function () {
					return ngModel.$invalid;
				};

				iAttrs.$set('ngClass', '{\'{0}\': showValidation() && fieldHasError()}'.interpolate(formsTemplater.hasErrorClass));
				// AngularJS version implementation dependent.
				ngClassDirective[0].link(scope, iElement, iAttrs);
			},
			controller: function ValidateController() {
				var ngModelController;
				// getter/setter.
				this.ngModelController = function (value) {
					if (angular.isDefined(value) && !ngModelController) {
						ngModelController = value;
					}
					return ngModelController;
				};
			}
		};
	})


	.directive('ngModel', function () {
		return {
			require: ['?^validate', 'ngModel'],
			link: function (scope, iElement, iAttrs, controllers) {
				var validateCtrl = controllers[0];
				if (validateCtrl) {
					validateCtrl.ngModelController(controllers[1]);
				}
			}
		};
	})

	.directive('invalidation', function (formsTemplater) {
		return {
			priority: 1, // before transclusion
			compile: function (tElement) {
				tElement.addClass(formsTemplater.helpBlockClass);
			}
		};
	})

	.directive('invalidation', function ($parse, ngIfDirective) {
		return {
			restrict: 'A',
			transclude: 'element',
			require: '^validate',
			scope: true,
			link: function (scope, iElement, iAttrs, validateCtrl, transclude) {
				var ngModel = validateCtrl.ngModelController();
				if (!ngModel) {
					return;
				}

				var expr = iAttrs.invalidation;
				var key = iAttrs.key || iAttrs.invalidation;

				var evaluate = (expr && !ngModel.$validators[key]) ? $parse(expr) : null;

				scope.hasError = function () {
					var condition = evaluate ? evaluate(scope.$parent) : ngModel.$error[key];
					if (evaluate) {
						ngModel.$setValidity(key, !condition);
					}

					return validateCtrl.showValidation() && condition;
				};

				iAttrs.ngIf = 'hasError()';
				// AngularJS version implementation dependent.
				ngIfDirective[0].link(scope, iElement, iAttrs, null, transclude);
			}
		};
	})

	.directive('formInvalidation', function (formsTemplater) {
		return {
			priority: 1, // before transclusion
			compile: function (tElement) {
				tElement.addClass(formsTemplater.hasErrorClass);
				// Bootstrap requires help-block to be a child of has-error. Does not work in the same element (lame).
				tElement.wrapInner('<span class="{0}"></span>'.interpolate(formsTemplater.helpBlockClass));
			}
		};
	})

	.directive('formInvalidation', function ($parse, ngIfDirective) {
		return {
			restrict: 'A',
			transclude: 'element',
			require: '^form',
			scope: true,
			link: function (scope, iElement, iAttrs, formCtrl, transclude) {
				var key = iAttrs.formInvalidation;
				var evaluate = $parse(key);

				scope.hasError = function () {
					var condition = evaluate(scope.$parent);
					formCtrl.$setValidity(key, !condition);

					return formCtrl.$submitted && condition;
				};

				iAttrs.ngIf = 'hasError()';
				// AngularJS version implementation dependent.
				ngIfDirective[0].link(scope, iElement, iAttrs, null, transclude);
			}
		};
	});
})();
