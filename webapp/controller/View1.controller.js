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

		onInit: function () {
			//Create required DBs
			PouchDB("LocalToDos");
			PouchDB("TransactionDb");

			//Busy dialog while syncing
			this._BusyDialog = new BusyDialog({
				text: "Syncing"
			});

			//Listen for Online/Offline Status
			this.fnIsOnline();
		},

		//Handle online-offline events to show to the user
		fnIsOnline: function () {
			var that = this;
			window.addEventListener("offline", function () {
				var currentData = that.getView().getModel("onlineModel").getData();
				currentData.status = "Offline";
				currentData.enableSync = false;
				that.getView().getModel("onlineModel").setData(currentData);
			});
			window.addEventListener("online", function () {
				var currentData = that.getView().getModel("onlineModel").getData();
				currentData.status = "Online";
				currentData.enableSync = true;
				that.getView().getModel("onlineModel").setData(currentData);
			});
		},

		//Get current online status
		fnCurrentStatus: function () {
			//Current Status
			var currentData = this.getView().getModel("onlineModel").getData();
			if (window.navigator.onLine) {
				currentData.status = "Online";
				currentData.enableSync = true;
			} else {
				currentData.status = "Offline";
				currentData.enableSync = false;
			}
			this.getView().getModel("onlineModel").setData(currentData);
		},

		//Reusable function to copy data from local db to JSON model
		localDBtoJSONModel: function (db, oJSONModel) {
			//From local db store them into JSON model
			db.allDocs({
				include_docs: true,
				attachments: true
			}).then(function (result) {
				//Convert Date to Date Object
				jQuery.each(result.rows, function (index, value) {
					value.doc.DueDate = new Date(value.doc.DueDate);
				});

				oJSONModel.setData({
					"ToDos": result.rows
				});
			});
		},

		onBeforeRendering: function () {
			//Get current online status
			this.fnCurrentStatus();

			//All sync calls are deferred
			this.getView().getModel().setChangeGroups({
				"ToDo": {
					groupId: "sync",
					single: true ///Multiple changesets within a batch
				}
			});
			this.getView().getModel().setDeferredGroups(["sync"]);

			//Sync pending calls
			this.fnSync();
		},

		//Load ToDos from Server, or if offline from local DB		
		fnLoadToDosFromServer: function () {
			var oDataModel = this.getView().getModel();
			var oJSONModel = this.getView().getModel("oJSONModel");

			//Get instance of created Pouch DBs
			var db = PouchDB("LocalToDos");
			//Make a server call if possible
			oDataModel.read("/ToDos", {
				success: function (oData) {

					jQuery.each(oData.results, function (index, value) {
						value._id = value.id; //Storing backend key as _id for PouchDB record
						delete value.__metadata; //delete unecessary data
					});

					//We have latest records from server. So getrid of local ToDos
					//Store everything in local DB
					db.destroy().then(function () {
						db = new PouchDB("LocalToDos");
						db.bulkDocs(oData.results)
							//From localDB, move it to JSON model
							.then(this.localDBtoJSONModel(db, oJSONModel));
					}.bind(this));

				}.bind(this),
				error: this.localDBtoJSONModel //if server is not available, then get the data from local db
			});
		},

		//Plus button is clicked upon. Show the pop-up
		handleNewToDoButtonPress: function () {
			var oToDoDialog = sap.ui.xmlfragment("UI5ConOfflineApp.fragments.ToDoNew", this.getView().getController());
			//Bind Data by adding as dependent
			this.getView().addDependent(oToDoDialog);
			oToDoDialog.open();
		},

		//Save New ToDO 
		fnSaveNew: function (oEvent) {
			var transactionDb = PouchDB("TransactionDb");
			var db = PouchDB("LocalToDos");

			var oJSONModel = this.getView().getModel("oJSONModel");
			var Content = oEvent.getSource().getParent().getContent()[0].getItems()[0].getItems()[0].getValue();
			var Due = oEvent.getSource().getParent().getContent()[0].getItems()[0].getItems()[2].getDateValue();
			var date = new Date(Date.UTC(Due.getFullYear(), Due.getMonth(), Due.getDate()));
			var Data = {
				"Content": Content,
				"DueDate": date
			};

			//Add to the pendingcount
			this.fnIncreasePendingSyncCount();

			//Add the transaction to the pending que
			transactionDb.put({
				_id: jQuery.now().toString(), //current timestamp as id
				Payload: Data,
				ChangeType: "create",
				url: "/ToDos"
			});

			//Update the local DB, to add the new ToDo
			db.put({
					_id: jQuery.now().toString(),
					Content: Content,
					DueDate: date
				})
				//Update the JSON model from local DB
				.then(this.localDBtoJSONModel(db, oJSONModel));

			//If Online- run sync right away
			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}

			// Close the pop-up
			oEvent.getSource().getParent().close();
		},

		//When ToDo is clicked upon for editing, show the pop-up
		fnEditToDo: function () {
			if (!this.oToDoDialog) {
				this.oToDoDialog = sap.ui.xmlfragment("UI5ConOfflineApp.fragments.ToDo", this.getView().getController());
			}
			//Bind Data
			this.getView().addDependent(this.oToDoDialog);
			var oList = this.byId("ToDoList");
			var oSelectedItem = oList.getSelectedItem();
			this.oToDoDialog.setBindingContext(oSelectedItem.getBindingContext("oJSONModel"), "oJSONModel");

			this.oToDoDialog.open();
			//Unselect the item, so that it can be selected again
			oList.setSelectedItem(oSelectedItem, false);
		},

		//Saving an existing ToDo
		fnSaveEdit: function (evt) {
			var transactionDb = PouchDB("TransactionDb");
			var db = PouchDB("LocalToDos");
			var oJSONModel = this.getView().getModel("oJSONModel");
			var Content = evt.getSource().getParent().getContent()[0].getItems()[0].getItems()[0].getValue();
			var Due = evt.getSource().getParent().getContent()[0].getItems()[0].getItems()[2].getDateValue();
			var date = new Date(Date.UTC(Due.getFullYear(), Due.getMonth(), Due.getDate()));
			var id = evt.getSource().getParent().getBindingContext("oJSONModel").getObject().id;
			var Data = {
				"Content": Content,
				"DueDate": date
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
						Done: false,
						DueDate: date,
						LastChangedBy: doc.LastChangedBy,
						LastChangedOn: doc.LastChangedOn,
						id: id
					})
					//Update the JSON model from local DB
					.then(this.localDBtoJSONModel(db, oJSONModel));
			}.bind(this));

			//If Online- run sync right away
			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}

			// Close the pop-up
			evt.getSource().getParent().close();
		},

		//When "Done" checkbox was selected
		fnToDoDone: function (oEvent) {
			var transactionDb = PouchDB("TransactionDb");
			var db = PouchDB("LocalToDos");

			//Collect
			var id = oEvent.getSource().getParent().getBindingContext("oJSONModel").getObject().doc._id;
			var itemId = oEvent.getSource().getParent().getBindingContext("oJSONModel").getObject().doc.id;
			var Path = oEvent.getSource().getParent().getBindingContext("oJSONModel").sPath;
			var oJSONModel = this.getView().getModel("oJSONModel");
			this.getView().getModel("oJSONModel").getProperty(Path).doc.Done = true;
			var Payload = this.getView().getModel("oJSONModel").getProperty(Path);
			//Add to the pendingcount
			this.fnIncreasePendingSyncCount();

			//Que it up in the pending transaction db
			transactionDb.put({
				_id: Payload.doc.id,
				Payload: Payload.doc,
				ChangeType: "done",
				url: "/ToDos('" + itemId + "')"
			});

			db.get(id).then(function (doc) {
				//Remove the 'Done' ToDo
				db.remove(id, doc._rev).then(function () {
					//Refresh the ToDo list on the screen from local DB
					db.allDocs({
						include_docs: true,
						attachments: true
					}).then(function (result) {
						//Convert Date to Date Object
						jQuery.each(result.rows, function (index, value) {
							value.doc.DueDate = new Date(value.doc.DueDate);
						});
						oJSONModel.setData({
							"ToDos": null
						});
						oJSONModel.setData({
							"ToDos": result.rows
						});
					});
				});
			});

			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}
		},

		//Increase pending transactions count
		fnIncreasePendingSyncCount: function () {
			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.pendingTransactions === undefined) {
				currentData.pendingTransactions = 0;
			}
			currentData.pendingTransactions = currentData.pendingTransactions + 1;
			this.getView().getModel("onlineModel").setData(currentData);
		},

		//Sync with backend
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
					case "done":  //When 'Done' is selected
						delete value.doc.Payload._id;  //not required for GW server
						delete value.doc.Payload._rev; //not required for GW server
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

				if (oDataModel.hasPendingChanges()) {
					//Send to backend
					oDataModel.submitChanges({
						groupId: "sync",
						success: this.fnSyncSuccess.bind(this),
						error: this.fnSyncFailure
					});
				} else {
					this.fnSyncSuccess();
				}
			}.bind(this));
		},

		//Sync is successfull. What to do now?
		fnSyncSuccess: function () {
			this._BusyDialog.close();

			//Clear pending transaction count
			this.fnMarkSyncComplete();

			//Remove all entries from localPendingTransactions
			var transactionDb = PouchDB("TransactionDb");
			transactionDb.destroy().then(function(){
				transactionDb = new PouchDB("TransactionDb");	
			});

			//Load ToDos from Server, or if offline from local DB
			this.fnLoadToDosFromServer();
		},

		//Sync failure. What to do now?		
		fnSyncFailure: function () {
			this._BusyDialog.close();
			//Inform the user
		},

		//Clear pending transaction count
		fnMarkSyncComplete: function () {
			var currentData = this.getView().getModel("onlineModel").getData();
			currentData.pendingTransactions = 0;
			this.getView().getModel("onlineModel").setData(currentData);
		},

		//Closing the Pop-up
		fnClose: function (evt) {
			evt.getSource().getParent().close();
		}
	});
});