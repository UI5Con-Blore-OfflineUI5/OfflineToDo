sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"UI5ConOfflineApp/model/models"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("UI5ConOfflineApp.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// set the device model
			this.setModel(models.createDeviceModel(), "device");

			//Cache UI5 resources
			// caches.open('mycache').then((cache) => {
			// 	cache.addAll(['/sap/bc/ui5_ui5/ui2/ushell/resources/~20170330091900~/sap/fiori/core-min-0.js',
			// 		'/sap/bc/ui5_ui5/ui2/ushell/resources/~20170330091900~/sap/ushell_abap/bootstrap/abap.js',
			// 		'/fiori/shells/abap/Fiorilaunchpad.html?sap-theme=sap_bluecrystal&sap-client=001&sap-language=EN',
			// 		"/resources/sap-ui-core.js",
			// 		"/test-resources/sap/ushell/shells/sandbox/fioriSandbox.html?hc_orionpath=%2FDI_webide_di_workspacelu218rwu28v3x95a%2FOfflineToDo&neo-di-affinity=BIGipServerdisapwebide.us1.hana.ondemand.com+%21PhJaQ6eMYSKZJfsgpJRuKzPfeVjPu2TsHr%2BZEezEJTqXoKEzWK3GITFMTelNtpg6Kxboc3Tg9IOhhs0%3D&sap-ui-xx-componentPreload=off&sap-ui-appCacheBuster=..%2F..%2F..%2F..%2F..%2F&sap-ushell-test-url-url=..%2F..%2F..%2F..%2F..%2Fwebapp&sap-ushell-test-url-additionalInformation=SAPUI5.Component%3DUI5ConOfflineApp"
			// 	]).then(() => {
			// 		//all requests were cached
			// 	})
			// });
		}
	});

});