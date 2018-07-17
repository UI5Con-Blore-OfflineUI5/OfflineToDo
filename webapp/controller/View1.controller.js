/* global PouchDB: true */
sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/m/GroupHeaderListItem",
	"UI5ConOfflineApp/formatter/formatter"
], function (Controller, GroupHeaderListItem, formatter) {
	"use strict";

	return Controller.extend("UI5ConOfflineApp.controller.View1", {
		formatter: formatter,

		fnSync: function () {
			var transactionDb = PouchDB('TransactionDb');
			var db = PouchDB('LocalToDos');
			var oDataModel = this.getView().getModel();
			//Fetch pending changes to be synced
			var aPendingChanges;
			//= this.transactionDb.getallDocs();

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
				//Send to backed
				oDataModel.submitChanges({
					// groupId: "sync", "If no groupID mentioned, then all groups are submitted"
					success: this.fnSyncSuccess.bind(this),
					error: this.fnSyncFailure
				});
			}.bind(this)).catch(function (err) {
				console.log(err);
			});

			//This is going to be a single $batch call with multiple changesets
			// for (var i = 0; i < aPendingChanges.length; i++) {
			// 	oDataModel.update(aPendingChanges.url, aPendingChanges.payload, {
			// 		groupId: "sync"
			// 	});
			// }

		},
		fnSyncSuccess: function (oData) {
			// console.log("success odata call");
			//Remove from localPendingTransactions
			var oJSONModel = this.getView().getModel("oJSONModel");
			var oDataModel = this.getView().getModel();
			var db = PouchDB('LocalToDos');
			var transactionDb = PouchDB('TransactionDb');

			//Clear count
			this.fnMarkSyncComplete();
			// 
			db.allDocs().then(function (result) {
				// Promise isn't supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return db.remove(row.id, row.value.rev);
				}));
			}).then(function () {
				// done!
			}).catch(function (err) {
				// error!
			});

			transactionDb.allDocs().then(function (result) {
				// Promise isn't supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return transactionDb.remove(row.id, row.value.rev);
				}));
			}).then(function () {
				// done!
			}).catch(function (err) {
				// error!
			});

			oDataModel.read("/ToDos", {
				success: function (oData) {
					jQuery.each(oData.results, function (index, value) {
						value._id = value.id;
						delete value.__metadata;

					});

					db.bulkDocs(oData.results).then(function (result, doc) {
						console.log('Successfully posted a todo!');
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
				error: function (response) {

				}
			});

		},
		fnSyncFailure: function (oError) {
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
			window.addEventListener("offline", function (e) {
				var currentData = that.getView().getModel("onlineModel").getData();
				currentData.status = "Offline";
				that.getView().getModel("onlineModel").setData(currentData);
			});
			window.addEventListener("online", function (e) {
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
			var db = new PouchDB('LocalToDos');
			var transactionDb = new PouchDB('TransactionDb');

			//Online Status
			this.fnIsOnline();

		},
		onBeforeRendering: function () {
			this.fnCurrentStatus();
			var oJSONModel = this.getView().getModel("oJSONModel");
			var oDataModel = this.getView().getModel();
			var db = PouchDB('LocalToDos');
			var transactionDb = PouchDB('TransactionDb');
			db.allDocs().then(function (result) {
				// Promise isn't supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return db.remove(row.id, row.value.rev);
				}));
			}).then(function () {
				// done!
			}).catch(function (err) {
				// error!
			});

			transactionDb.allDocs().then(function (result) {
				// Promise isn't supported by all browsers; you may want to use bluebird
				return Promise.all(result.rows.map(function (row) {
					return transactionDb.remove(row.id, row.value.rev);
				}));
			}).then(function () {
				// done!
			}).catch(function (err) {
				// error!
			});

			oDataModel.read("/ToDos", {
				success: function (oData) {
					jQuery.each(oData.results, function (index, value) {
						value._id = value.id;
						delete value.__metadata;

					});

					db.bulkDocs(oData.results).then(function (result, doc) {
						console.log('Successfully posted a todo!');
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
				error: function (response) {

				}
			});

			//All sync calls are deferred
			this.getView().getModel().setChangeGroups({"ToDo":{groupId:"sync", single: true}});
			this.getView().getModel().setDeferredGroups(["sync"]);
		},
		// oDataCall: function() {
		// 	var oJSONModel = this.getView().getModel("oJSONModel");
		// 	var oDataModel = this.getView().getModel();
		// 	oJSONModel.setData({
		// 		"ToDos": null
		// 	});
		// 	oDataModel.read("/ToDos", {
		// 		success: function(oData) {
		// 			oJSONModel.setData({
		// 				"ToDos": oData.results
		// 			});

		// 		},
		// 		error: function(response) {

		// 		}
		// 	});
		// },
		// fnGetGroupHeader: function(oGroup) {
		// 	return new GroupHeaderListItem({
		// 		title: oGroup.key,
		// 		upperCase: false
		// 	}).addStyleClass("sapMH1Style");
		// },
		handleNewToDoButtonPress: function () {
			// if (!oToDoDialog) {
			var oToDoDialog = sap.ui.xmlfragment("UI5ConOfflineApp.fragments.ToDoNew", this.getView().getController());
			// }
			//Bind Data
			this.getView().addDependent(oToDoDialog);
			//oToDoDialog.setModel(this.getView().getModel("oJSONModel"),"oJSONModel");
			var oList = this.byId("ToDoList");
			oToDoDialog.open();

		},
		fnSaveEdit: function (evt) {
			var oDataModel = this.getView().getModel();
			var transactionDb = PouchDB('TransactionDb');
			var db = PouchDB('LocalToDos');
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

			transactionDb.put({
				_id: id,
				Payload: Data,
				ChangeType: "edit",
				url: "/ToDos('" + id + "')"
			}).then(function (response) {
				console.log("POST Successful");
			}).catch(function (err) {
				console.log(err);
			});

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

			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}
			// var array = oJSONModel.getData().ToDos;
			// array.push(Data);
			// oJSONModel.setData({
			// 	"ToDos": array
			// });
			// oDataModel.create("/ToDos", Data, {
			// 	success: function(response) {

			// 	}.bind(this),
			// 	error: function(response) {

			// 	}
			// });
			evt.getSource().getParent().close();

		},
		fnSave: function (oEvent) {
			var transactionDb = PouchDB('TransactionDb');
			var db = PouchDB('LocalToDos');
			var oDataModel = this.getView().getModel();
			var oJSONModel = this.getView().getModel("oJSONModel");
			var Content = oEvent.getSource().getParent().getContent()[0].getItems()[0].getItems()[0].getValue();
			var Due = oEvent.getSource().getParent().getContent()[0].getItems()[0].getItems()[2].getDateValue();
			var Data = {
				"Content": Content,
				"DueDate": Due
			};
			// var array = oJSONModel.getData().ToDos;
			// array.push(Data);
			// oJSONModel.setData({
			// 	"ToDos": array
			// });

			//Add to the pendingcount
			this.fnIncreasePendingSyncCount();

			transactionDb.put({
				_id: jQuery.now().toString(),
				Payload: Data,
				ChangeType: "create",
				url: "/ToDos"
			}).then(function (response) {
				console.log("POST Successful");
			}).catch(function (err) {
				console.log(err);
			});

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

			var currentData = this.getView().getModel("onlineModel").getData();
			if (currentData.status === "Online") {
				this.fnSync();
			}
			// oDataModel.create("/ToDos",Data,{
			// 	success:function(response){

			// 	}.bind(this),
			// 	error:function(response){

			// 	}
			// });
			oEvent.getSource().getParent().close();

		},
		fnEditToDo: function (evt) {
			if (!oToDoDialog) {
				var oToDoDialog = sap.ui.xmlfragment("UI5ConOfflineApp.fragments.ToDo", this.getView().getController());
			}
			//Bind Data
			this.getView().addDependent(oToDoDialog);
			//oToDoDialog.setModel(this.getView().getModel("oJSONModel"),"oJSONModel");
			var oList = this.byId("ToDoList");
			var oSelectedItem = oList.getSelectedItem();
			oToDoDialog.setBindingContext(oSelectedItem.getBindingContext("oJSONModel"), "oJSONModel");

			oToDoDialog.open();
			//Unselect the item, so that it can be selected again
			oList.setSelectedItem(oSelectedItem, false);
		},
		fnToDoDone: function (oEvent) {
			var transactionDb = PouchDB('TransactionDb');
			var db = PouchDB('LocalToDos');
			var id = oEvent.getSource().getParent().getBindingContext("oJSONModel").getObject().doc._id;
			var itemId = oEvent.getSource().getParent().getBindingContext("oJSONModel").getObject().doc.id;
			var Path = oEvent.getSource().getParent().getBindingContext("oJSONModel").sPath;
			//this.getView().getModel("oJSONModel").setProperty(Path + "/doc/Done", true);
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
			//Mark as done
			// var oModel = this.getView().getModel();
			// oModel.update("/ToDos('" + itemId + "')", Payload.doc, {
			// 	success: this.mySuccessHandler(),
			// 	error: this.myErrorHandler()
			// });
		},
		// mySuccessHandler: function(Response) {
		// 	this.oDataCall();
		// },
		// myErrorHandler: function(error) {

		// },
		//Closing the Po-up
		fnClose: function (evt) {
			evt.getSource().getParent().close();
		}
	});

});