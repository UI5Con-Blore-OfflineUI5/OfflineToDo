sap.ui.define(["sap/ui/core/format/DateFormat"], function (DateFormat) {
	"use strict";
	return {
		dueDate: function (oDate) {
			var resourceBundle = this.getView().getModel("i18n").getResourceBundle();
			return resourceBundle.getText("due") + " " + this.formatter.dateFormat(oDate);
		},
		statusColor: function (oDate) {
			var oToday = new Date();
			if (oDate > oToday) {
				return "Success";
			} else if (oDate < oToday) {
				return "Error";
			} else if (oDate === oToday) {
				return "Warning";
			}
		},
		dateFormat: function (oDate) {
			var oDateFormat = DateFormat.getDateInstance({
				style: "short"
			});
			return oDateFormat.format(oDate);
		}
	};
});