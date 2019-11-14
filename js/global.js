$(document).ready(function() {

	// email validation
	function validateEmail(email) {
	    var re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	    return re.test(String(email).toLowerCase());
	}

	// validate emails
	function validEmailList(array) {

		var returnArray = [];
		for(var i in array) {
			var email = array[i].trim();
			if(validateEmail(email) && !returnArray.includes(email)) returnArray.push(email);						
		}

		return returnArray;
	}

	// load chapter spreadsheet in csv format 
	$.get('https://docs.google.com/spreadsheets/d/1IBL93P6tqUhNMtH1hv_BK7YRzoeZtzklmq0rdtZsDTw/export?format=csv&gid=29839857', function(csv) {
		
		// convert csv to js object
		var data = $.csv.toObjects(csv);

		// get url parameter data
		var url = new URL(window.location.href);
		var preloadChapter = url.searchParams.get('chapter'), preloadID;

		// initialize map
        var map = L.map('map', {
            center: [25, 23], // center-ish of the world, overrided by fitBounds
            zoom: 3,
            scrollWheelZoom: true,
            attributionControl: false,
            noWrap: true,
            maxBoundsViscosity: 1000,
            maxBounds: [[78, -180],[-60, 180]] // cut off top and bottom of the map,
        });			        

        // focus control
		//map.on('focus', function() { map.scrollWheelZoom.enable(); });
		//map.on('blur', function() { map.scrollWheelZoom.disable(); });
		//map.on('popupopen popupclose', function(e) { $('#map').focus(); });

        // rough area of nearly all chapters visible
        var chapterBounds = [[60.345491, -127.807911],[-26.714219, 154.021961]];

        // fit map to screen displaying as many chapters as possible
		map.fitBounds(chapterBounds);
        map.setMinZoom(map.getBoundsZoom(map.options.maxBounds));

        // load theme/provider
        //L.tileLayer.provider('Esri.WorldGrayCanvas').addTo(map);

		L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
			noWrap: true,
			continuousWorld: false,
			bounds: [[-90, -180], [90, 180]]
		}).addTo(map);

		// spiderfier initiatilize
		var oms = new OverlappingMarkerSpiderfier(map, { nearbyDistance: 30, circleSpiralSwitchover: Infinity });

		// popup handler
		var popup = new L.Popup();

		// chapter popup
		function showChapterPopup(marker) {
			popup.setContent(`
            	<div class="chapterTitle">
					<img src="image.php/chapter.jpg?height=48&image=`+ marker.details.image +`" />
					<div class="chapterHeader">
						<h2>`+ marker.details.name +`</h2>
						<h3>`+ marker.details.location +`</h3>
					</div>
				</div>
				<table class="chapterDetails">
					`+marker.details.details+`
				</table>	
			`);
			popup.setLatLng(marker.getLatLng());
			map.openPopup(popup);									
		}

		// on click event for marker
        oms.addListener('click', function(marker) {
    		showChapterPopup(marker);
        });					

        // change opacity of markers when spiderfying
		oms.addListener('spiderfy', function (active, inactive) {				
			for(var i in inactive) {
				inactive[i].setOpacity(.2);
			}
		});

		oms.addListener('unspiderfy', function (active, inactive) {					
			for(var i in inactive) {
				inactive[i].setOpacity(1);
			}
		});

		// randomize chapters for load in
		data.sort(function(a, b) { return Math.random() - 0.5; });

        // get all chapters and add them to markers[]
        var markers = [];
		for(i in data) {

			if(data[i].Type == 'Chapter') {

				// add chapter image to preload array
				var chapterImage = 'image.php/chapter.jpg?height=30&cropratio=1:1&image='+ data[i].Image;		

				// preload image
				$('<img>').attr('src', chapterImage);

				// marker HTML template 
	            var markerContent = '<div class="chapterMarker"><img src="'+ chapterImage +'" /><span>'+ data[i].Name +'</span></div>';

	            // icon declaration
	            var icon = L.divIcon({
	                html: markerContent,
	                iconSize: [31, 38],
	                iconAnchor: [15, 38]
	            });

	            var chapterDetails = '';

	            // relevant data from spreadsheet
	            var availableFields = [
	            	'Facebook',
	            	'Email address',
	            	'Phone',
	            	'Name of Chapter Leader(s)'
	            ];

	            // e-mail fields
	            var emailFields = [
	            	'Email address',
	            	'Email for Chapter Leader',
	            	'Chapter Email'
	            ];

				// get information from fields
	            for(var j in availableFields) {
	            	if(data[i][availableFields[j]] != '' && availableFields[j] != 'Email address') {

	            		var fieldName = availableFields[j];
	            		var fieldValue = data[i][availableFields[j]]

	            		if(fieldName == 'Name of Chapter Leader(s)') {
	            			fieldName = fieldName.replace('Name of ', '');
	            		}

	            		if(fieldName == 'Facebook') {
	            			var urlString = fieldValue.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "");
	            			fieldValue = '<a href="'+fieldValue+'" target="_blank">'+urlString+'</a>';
	            		}

	            		chapterDetails += '<tr><td>'+fieldName+'</td><td>'+fieldValue+'</td></tr>';

	            	} else if(availableFields[j] == 'Email address') {

	            		// gather all email addresses into one list
            			var emailList  = [];

            			for(var y in emailFields) {
            				emailList = emailList.concat(data[i][emailFields[y]].split(','));
            			}
            			
            			var validEmails = validEmailList(emailList);
            			if(validEmails.length > 0) {
	            			for(var y in validEmails) {
	            				validEmails[y] = '<a href="mailto:'+validEmails[y]+'" target="_blank">'+validEmails[y]+'</a>';
	            			}

	            			chapterDetails += '<tr><td>'+availableFields[j]+'</td><td>'+validEmails.join(', ')+'</td></tr>';	
            			}	
	            	}
	            }

	            // marker declaration
	            var marker = L.marker([data[i].Latitude, data[i].Longitude], {
	                icon: icon,
	                title: data[i].Name
	            });

	            // save data for later use
	            marker.coords  = [data[i].Latitude, data[i].Longitude];
	            marker.details = { image: data[i].Image, name: data[i].Name, location: data[i].Location, details: chapterDetails };

	            // add marker to array for later activation				           
				markers.push(marker);

	            // activate marker if requested
	            if(preloadChapter == data[i].Name) preloadID = markers.length-1;

			}
		}			

		// wait for map to finish loading
		map.whenReady(function() {

			// search layer
			var markersLayer = new L.LayerGroup();				
			map.addLayer(markersLayer);

			var controlSearch = new L.Control.Search({
				position: 'topleft',		
				layer: markersLayer,
				initial: false,
				zoom: 6,
				marker: false,
				animate: true
			});

			map.addControl(controlSearch);

			controlSearch.on('search:locationfound', function(e) {
				showChapterPopup(e.layer);
					//e.layer.openPopup();
				
			});

			$('.leaflet-pane, .leaflet-control-container, #findChapter').fadeIn(500);

			// delay interval for animations or cancel for immediate display
			var delayInterval = (preloadID) ? 0 : 30;

			// if preload
			if(preloadID) {							
				var marker = markers[preloadID];
            	showChapterPopup(marker);
				map.flyTo(marker.coords, 6, {animate: false});
			}

			// set snap level
			map.options.zoomSnap = 0.25;

			// animate the markers in
			setTimeout(function() {
				for(var i in markers) {
					(function(index) {
						setTimeout(function() { 

							var marker = markers[index];

							// add marker to the map from the array
							marker.addTo(map); 
							oms.addMarker(marker);	
							markersLayer.addLayer(marker);						            

						}, index*delayInterval); // delay between adding each marker 
					})(i);			
				}
			}, 500); // wait for visuals to update just in case
		});
		

		// find closest marker function
		$('#findChapter').on('click', function() {

			// request GEO API access
			navigator.geolocation.getCurrentPosition(function(e) {

				var distances = [];

				// find distances of markers to user
				for(var i in markers) {
					var distance = L.latLng([e.coords.latitude, e.coords.longitude]).distanceTo(markers[i].coords)/1000;
					distances.push([i, distance]);
				}

				// sort by closest markers
				distances.sort(function(a, b) { return a[1] - b[1]; });

				var targetMarker = markers[distances[0][0]];
				var animation = 2;

				// zoom in on marker and show popup
            	map.flyTo(targetMarker.coords, 6, { animate: true, duration : animation });
            	setTimeout(function() {
            		showChapterPopup(targetMarker);
            	}, animation*1000);

			});
		});
	})

});		