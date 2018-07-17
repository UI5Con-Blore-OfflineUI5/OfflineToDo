/* global PouchDB: true */
/* global Promise: true */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/GroupHeaderListItem",
	"UI5ConOfflineApp/formatter/formatter",
	"sap/m/BusyDialog"
], function (Controller, GroupHeaderListItem, formatter, BusyDialog) {
	"use strict";

	return Controller.extend("UI5ConOfflineApp.controller.View1", {
		formatter: formatter,

		fnSync: function () {
			var transactionDb = PouchDB("TransactionDb");
			var oDataModel = this.getView().getModel();

			//Fetch pending changes to be synced
			transactionDb.allDocs({
				include_docs: true,
				attachments: true
			}).then(function (result) {
				jQuery.each(result.rows, function (index, value) {
					switch (value.doc.ChangeType) {
					case "edit":
						value.doc.Payload.DueDate = new Date(value.doc.Payload.DueDate);
						oDataModel.update(value.doc.url, value.doc.Payload, {
							changeSetId: Math.random().toString(36).substring(3)
						});
						break;
					case "create":
						value.doc.Payload.DueDate = new Date(value.doc.Payload.DueDate);
						oDataModel.create(value.doc.url, value.doc.Payload, {
							changeSetId: Math.random().toString(36).substring(3)
						});
						break;
					case "update":
						delete value.doc.Payload._id;
						delete value.doc.Payload._rev;
						value.doc.Payload.DueDate = new Date(value.doc.Payload.DueDate);
						value.doc.Payload.LastChangedOn = new Date(value.doc.Payload.LastChangedOn);
						oDataModel.update(value.doc.url, value.doc.Payload, {
							changeSetId: Math.random().toString(36).substring(3)
						});
						break;
					}
				});

				oDataModel.attachEventOnce("batchRequestSent", function () {
					this._BusyDialog.open();
				}.bind(this));
				oDataModel.attachEventOnce("batchRequestCompleted", this.fnSyncSuccess.bind(this));
				oDataModel.attachEventOnce("batchRequestFailed", this.fnSyncFailure.bind(this));

				//Send to backed
				oDataModel.submitChanges({
					groupId: "sync", //If no groupID mentioned, then all groups are submitted"
					success: this.fnSyncSuccess.bind(this),
					error: this.fnSyncFailure
				});
			}.bind(this)).catch(function (err) {
				console.log(err);
			});
		},
		//Sync is successfull. What to do now?
		fnSyncSuccess: function (oData) {
			this._BusyDialog.close();
			
			var oJSONModel = this.getView().getModel("oJSONModel");
			var oDataModel = this.getView().getModel();
			var db = PouchDB("LocalToDos");
			var transactionDb = PouchDB("TransactionDb");

			//Clear count
			this.fnMarkSyncComplete();

			// 
			db.allDocs().then(function (result) {
				// Promise isn"t supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return db.remove(row.id, row.value.rev);
				}));
			});

			//Remove all entries from localPendingTransactions
			transactionDb.allDocs().then(function (result) {
				// Promise isn't supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return transactionDb.remove(row.id, row.value.rev);
				}));
			});

			//Read latest ToDos from server
			oDataModel.read("/ToDos", {
				success: function (oData) {
					jQuery.each(oData.results, function (index, value) {
						value._id = value.id;
						delete value.__metadata;
					});

					//Update the local DB
					db.bulkDocs(oData.results).then(function (result, doc) {
						console.log("Successfully posted a todo!");
						// handle result
					}).catch(function (err) {
						console.log(err);
					});

					//Read the local DB and update the JSON model so as to update the screen
					db.allDocs({
						include_docs: true,
						attachments: true
					}).then(function (result) {
						oJSONModel.setData({
							"ToDos": result.rows
						});
					}).catch(function (err) {
						console.log(err);
					});

				}.bind(this),
				error: function (response) {}
			});
		},
		fnSyncFailure: function (oError) {
			this._BusyDialog.close();
			//Inform the user
		},
		fnMarkSyncComplete: function () {
			var currentData = this.getView().getModel("onlineModel").getData();
			currentData.pendingTransactions = 0;
			this.getView().getModel("onlineModel").setData(currentData);
		},
		fnIncreasePendingSyncCount: function () {
			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.pendingTransactions === undefined) {
				currentData.pendingTransactions = 0;
			}
			currentData.pendingTransactions = currentData.pendingTransactions + 1;
			this.getView().getModel("onlineModel").setData(currentData);
		},
		fnIsOnline: function () {
			var that = this;
			window.addEventListener("offline", function () {
				var currentData = that.getView().getModel("onlineModel").getData();
				currentData.status = "Offline";
				that.getView().getModel("onlineModel").setData(currentData);
			});
			window.addEventListener("online", function () {
				var currentData = that.getView().getModel("onlineModel").getData();
				currentData.status = "Online";
				that.getView().getModel("onlineModel").setData(currentData);
			});
		},
		fnCurrentStatus: function () {
			//Current Status
			var currentData = this.getView().getModel("onlineModel").getData();
			if (window.navigator.onLine) {
				currentData.status = "Online";
			} else {
				currentData.status = "Offline";
			}
			this.getView().getModel("onlineModel").setData(currentData);
		},
		onInit: function () {
			//Create required DBs
			var db = new PouchDB("LocalToDos");
			var transactionDb = new PouchDB("TransactionDb");
			this._BusyDialog = new BusyDialog({text: "Syncing"});

			//Online Status
			this.fnIsOnline();
		},
		onBeforeRendering: function () {
			this.fnCurrentStatus();
			var oJSONModel = this.getView().getModel("oJSONModel");
			var oDataModel = this.getView().getModel();
			var db = PouchDB("LocalToDos");
			var transactionDb = PouchDB("TransactionDb");
			db.allDocs().then(function (result) {
				// Promise isn't supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return db.remove(row.id, row.value.rev);
				}));
			});

			transactionDb.allDocs().then(function (result) {
				// Promise isn't supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return transactionDb.remove(row.id, row.value.rev);
				}));
			});

			oDataModel.read("/ToDos", {
				success: function (oData) {
					jQuery.each(oData.results, function (index, value) {
						value._id = value.id;
						delete value.__metadata;
					});
					db.bulkDocs(oData.results).then(function (result, doc) {
						console.log("Successfully posted a todo!");
						// handle result
					}).catch(function (err) {
						console.log(err);
					});
					db.allDocs({
						include_docs: true,
						attachments: true
					}).then(function (result) {
						oJSONModel.setData({
							"ToDos": result.rows
						});
					}).catch(function (err) {
						console.log(err);
					});
				}.bind(this),
				error: function (response) {}
			});

			//All sync calls are deferred
			this.getView().getModel().setChangeGroups({
				"ToDo": {
					groupId: "sync",
					single: true
				}
			});
			this.getView().getModel().setDeferredGroups(["sync"]);
		},
		handleNewToDoButtonPress: function () {
			var oToDoDialog = sap.ui.xmlfragment("UI5ConOfflineApp.fragments.ToDoNew", this.getView().getController());
			//Bind Data
			this.getView().addDependent(oToDoDialog);
			oToDoDialog.open();
		},
		//Editing and Saving an existing ToDo
		fnSaveEdit: function (evt) {
			var transactionDb = PouchDB("TransactionDb");
			var db = PouchDB("LocalToDos");
			var oJSONModel = this.getView().getModel("oJSONModel");
			var Content = evt.getSource().getParent().getContent()[0].getItems()[0].getItems()[0].getValue();
			var Due = evt.getSource().getParent().getContent()[0].getItems()[0].getItems()[2].getDateValue();
			var Done = evt.getSource().getParent().getContent()[0].getItems()[0].getItems()[5].getSelected();
			var id = evt.getSource().getParent().getBindingContext("oJSONModel").getObject().id;
			var Data = {
				"Content": Content,
				"DueDate": Due
			};

			//Add to the pendingcount
			this.fnIncreasePendingSyncCount();

			//Add the transaction to the pending que
			transactionDb.put({
				_id: id,
				Payload: Data,
				ChangeType: "edit",
				url: "/ToDos('" + id + "')"
			});

			//Update the local DB record
			db.get(id).then(function (doc) {
				return db.put({
					_id: id,
					_rev: doc._rev,
					Content: Content,
					Done: Done,
					DueDate: Due,
					LastChangedBy: doc.LastChangedBy,
					LastChangedOn: doc.LastChangedOn,
					id: id
				});
			}.bind(this)).then(function (response) {
				db.allDocs({
					include_docs: true,
					attachments: true
				}).then(function (result) {
					oJSONModel.setData({
						"ToDos": result.rows
					});
				}).catch(function (err) {
					console.log(err);
				});

				console.log("UPDATE Successful");
			}.bind(this)).catch(function (err) {
				console.log(err);
			});

			//If Online- run sync right away
			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}

			// Close the pop-up
			evt.getSource().getParent().close();

		},
		//New ToDO added
		fnSave: function (oEvent) {
			var transactionDb = PouchDB("TransactionDb");
			var db = PouchDB("LocalToDos");

			var oJSONModel = this.getView().getModel("oJSONModel");
			var Content = oEvent.getSource().getParent().getContent()[0].getItems()[0].getItems()[0].getValue();
			var Due = oEvent.getSource().getParent().getContent()[0].getItems()[0].getItems()[2].getDateValue();
			var Data = {
				"Content": Content,
				"DueDate": Due
			};

			//Add to the pendingcount
			this.fnIncreasePendingSyncCount();

			//Add the transaction to the pending que
			transactionDb.put({
				_id: jQuery.now().toString(), //current timestamp as id
				Payload: Data,
				ChangeType: "create",
				url: "/ToDos"
			}).then(function (response) {
				console.log("POST Successful");
			}).catch(function (err) {
				console.log(err);
			});

			//Update the local DB, to add the new ToDo
			db.put({
				_id: jQuery.now().toString(),
				Content: Content,
				DueDate: Due
			}).then(function (response) {

				db.allDocs({
					include_docs: true,
					attachments: true
				}).then(function (result) {
					oJSONModel.setData({
						"ToDos": result.rows
					});
				}).catch(function (err) {
					console.log(err);
				});

				console.log("UPDATE Successful");
			}).catch(function (err) {
				console.log(err);
			});

			//If Online- run sync right away
			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}

			// Close the pop-up
			oEvent.getSource().getParent().close();
		},

		//When ToDo is clicked upon
		fnEditToDo: function () {
			if (!this.oToDoDialog) {
				this.oToDoDialog = sap.ui.xmlfragment("UI5ConOfflineApp.fragments.ToDo", this.getView().getController());
			}
			//Bind Data
			this.getView().addDependent(this.oToDoDialog);
			//oToDoDialog.setModel(this.getView().getModel("oJSONModel"),"oJSONModel");
			var oList = this.byId("ToDoList");
			var oSelectedItem = oList.getSelectedItem();
			this.oToDoDialog.setBindingContext(oSelectedItem.getBindingContext("oJSONModel"), "oJSONModel");

			this.oToDoDialog.open();
			//Unselect the item, so that it can be selected again
			oList.setSelectedItem(oSelectedItem, false);
		},

		//When "Done" checkbox was selected
		fnToDoDone: function (oEvent) {
			var transactionDb = PouchDB("TransactionDb");
			var db = PouchDB("LocalToDos");
			var id = oEvent.getSource().getParent().getBindingContext("oJSONModel").getObject().doc._id;
			var itemId = oEvent.getSource().getParent().getBindingContext("oJSONModel").getObject().doc.id;
			var Path = oEvent.getSource().getParent().getBindingContext("oJSONModel").sPath;
			var oJSONModel = this.getView().getModel("oJSONModel");
			this.getView().getModel("oJSONModel").getProperty(Path).doc.Done = true;
			var Payload = this.getView().getModel("oJSONModel").getProperty(Path);

			//Add to the pendingcount
			this.fnIncreasePendingSyncCount();

			transactionDb.put({
				_id: Payload.doc.id,
				Payload: Payload.doc,
				ChangeType: "update",
				url: "/ToDos('" + itemId + "')"
			}).then(function (response) {
				console.log("POST Successful");
			}).catch(function (err) {
				console.log(err);
			});

			db.get(id).then(function (doc) {
				return db.put({
					_id: id,
					_rev: doc._rev,
					Content: doc.Content,
					Done: true,
					DueDate: doc.DueDate,
					LastChangedBy: doc.LastChangedBy,
					LastChangedOn: doc.LastChangedOn,
					id: doc.id
				});
			}).then(function (response) {
				// handle response
			}).catch(function (err) {
				console.log(err);
			});

			//Refresh the ToDo list on the screen from local DB
			db.allDocs({
				include_docs: true,
				attachments: true
			}).then(function (result) {
				oJSONModel.setData({
					"ToDos": result.rows
				});
			}).catch(function (err) {
				console.log(err);
			});

			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}
		},

		//Closing the Pop-up
		fnClose: function (evt) {
			evt.getSource().getParent().close();
		}
	});

});