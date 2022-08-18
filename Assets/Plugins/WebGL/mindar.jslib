var LibraryWebCamWebGL = {
	$activeWebCams: {},
	$cameraAccess: 0, //0 = access unknown, 1 = access granted, 2 = access denied
	
	SetMindARCallBack: function(cb) {
		window.MindARCallBack = cb;
	},

	JS_WebCam_IsSupported__proxy: 'sync',
	JS_WebCam_IsSupported__sig: 'i',
	JS_WebCam_IsSupported: function() {
		return !!navigator.mediaDevices;
	},

	JS_AsyncWebCam_GetPermission__proxy: 'sync',
	JS_AsyncWebCam_GetPermission__sig: 'vii',
	JS_AsyncWebCam_GetPermission__deps: ['$cameraAccess'],
	JS_AsyncWebCam_GetPermission: function(op, onWebcamAccessResponse) {
		if (!navigator.mediaDevices) {
			cameraAccess = 2;
			{{{ makeDynCall('vi', 'onWebcamAccessResponse') }}}(op);
			return;
		}
		navigator.mediaDevices.getUserMedia({
			audio: false,
			video: true
		}).then(function(stream) {
        	//getUserMedia requests for permission (we want this) and starts the webcam (we don't want this), we're going to immediately turn it off after getting permission
      		var tracks = stream.getVideoTracks();
      		tracks.forEach(function(track) {
        		track.stop();
      		});
			cameraAccess = 1;
			navigator.mediaDevices.enumerateDevices().then(function(devices) {
				updateVideoInputDevices(devices);
				{{{ makeDynCall('vi', 'onWebcamAccessResponse') }}}(op);
			});
      	}).catch(function(err) {
			cameraAccess = 2;
			{{{ makeDynCall('vi', 'onWebcamAccessResponse') }}}(op);
      	});
  	},

	JS_GetCurrentCameraAccessState__proxy: 'sync',
	JS_GetCurrentCameraAccessState__sig: 'i',
	JS_GetCurrentCameraAccessState__deps: ['$cameraAccess'],
	JS_GetCurrentCameraAccessState: function() {
		return cameraAccess;
	},


	JS_WebCamVideo_GetNumDevices__proxy: 'sync',
	JS_WebCamVideo_GetNumDevices__sig: 'i',
	JS_WebCamVideo_GetNumDevices: function() {
		// If a WebCam is disconnected in the middle of the list,
		// we keep reporting that index as (disconnected), so
		// find the max ID of devices as the device count.
		var numDevices = 0;
		Object.keys(videoInputDevices).forEach(function(i) {
			numDevices = Math.max(numDevices, videoInputDevices[i].id+1);
		});

		return numDevices;
	},

	JS_WebCamVideo_GetDeviceName__proxy: 'sync',
	JS_WebCamVideo_GetDeviceName__sig: 'iiii',
	JS_WebCamVideo_GetDeviceName: function(deviceId, buffer, bufferSize) {
		var webcam = videoInputDevices[deviceId];
		var name = webcam ? webcam.name : '(disconnected input #' + (deviceId + 1) + ')';
		if (buffer) stringToUTF8(name, buffer, bufferSize);
		return lengthBytesUTF8(name);
	},

	JS_WebCamVideo_IsFrontFacing__proxy: 'sync',
	JS_WebCamVideo_IsFrontFacing__sig: 'iiii',
	JS_WebCamVideo_IsFrontFacing: function(deviceId) {
		return videoInputDevices[deviceId].isFrontFacing;
	},

	JS_WebCamVideo_GetNativeWidth__proxy: 'sync',
	JS_WebCamVideo_GetNativeWidth__sig: 'ii',
	JS_WebCamVideo_GetNativeWidth__deps: ['$activeWebCams'],
	JS_WebCamVideo_GetNativeWidth: function(deviceId) {
		return activeWebCams[deviceId] && activeWebCams[deviceId].video.videoWidth;
	},

	JS_WebCamVideo_GetNativeHeight__proxy: 'sync',
	JS_WebCamVideo_GetNativeHeight__sig: 'ii',
	JS_WebCamVideo_GetNativeHeight__deps: ['$activeWebCams'],
	JS_WebCamVideo_GetNativeHeight: function(deviceId) {
		return activeWebCams[deviceId] && activeWebCams[deviceId].video.videoHeight;
	},

	JS_WebCamVideo_Start__proxy: 'sync',
	JS_WebCamVideo_Start__sig: 'vi',
	JS_WebCamVideo_Start__deps: ['$activeWebCams'],
	JS_WebCamVideo_Start: function(deviceId) {
		// Is the given WebCam device already enabled?
		if (activeWebCams[deviceId]) {
			++activeWebCams[deviceId].refCount;

			try {
				if(window.onWebcamVideoStart)
					window.onWebcamVideoStart(deviceId,activeWebCams);
			} catch (error) {
				console.error(error);				
			}
			return;
		}

		// No webcam exists with given ID?
		if (!videoInputDevices[deviceId]) {
			console.error('Cannot start video input with ID ' + deviceId + '. No such ID exists! Existing video inputs are:');
			console.dir(videoInputDevices);
			return;
		}

		navigator.mediaDevices.getUserMedia({
			audio: false,
			video: videoInputDevices[deviceId].deviceId ? {
				deviceId: { exact: videoInputDevices[deviceId].deviceId }
			} : true
		}).then(function(stream) {
			var video = document.createElement('video');
			video.srcObject = stream;

			if (/(iPhone|iPad|iPod)/.test(navigator.userAgent)) {
				warnOnce('Applying iOS Safari specific workaround to video playback: https://bugs.webkit.org/show_bug.cgi?id=217578');
				video.setAttribute('playsinline', '');
			}

			video.play();
			activeWebCams[deviceId] = {
				video: video,
				canvas: document.createElement('canvas'),
				stream: stream,
				// Webcams will likely operate on a lower framerate than 60fps, i.e. 30/25/24/15 or something like that. We will be polling
				// every frame to grab a new video frame, so obtain the actual frame rate of the video device so that we can avoid capturing
				// the same video frame multiple times, when we know that a new video frame cannot yet have been produced.
				frameLengthInMsecs: 1000 / stream.getVideoTracks()[0].getSettings().frameRate,
				nextFrameAvailableTime: 0,
				refCount: 1
			};
			
			try {
				if(window.onWebcamVideoStart)
					window.onWebcamVideoStart(deviceId,activeWebCams);
			} catch (error) {
				console.error(error);				
			}
		}).catch(function(e) {
			console.error('Unable to start video input! ' + e);
		});
	},

	JS_WebCamVideo_CanPlay__proxy: 'sync',
	JS_WebCamVideo_CanPlay__sig: 'ii',
	JS_WebCamVideo_CanPlay__deps: ['$activeWebCams'],
	JS_WebCamVideo_CanPlay: function(deviceId) {
		var webcam = activeWebCams[deviceId];
		return webcam && webcam.video.videoWidth > 0 && webcam.video.videoHeight > 0;
	},

	JS_WebCamVideo_Stop__proxy: 'sync',
	JS_WebCamVideo_Stop__sig: 'vi',
	JS_WebCamVideo_Stop__deps: ['$activeWebCams'],
	JS_WebCamVideo_Stop: function(deviceId) {
		var webcam = activeWebCams[deviceId];
		if (!webcam) return;

		try {
			if(window.onWebcamVideoStop)
					window.onWebcamVideoStop(deviceId,activeWebCams);
		} catch (error) {
			console.error(error);				
		}

		if (--webcam.refCount <= 0) {
			webcam.video.pause();
			webcam.video.srcObject = null;
			webcam.stream.getVideoTracks().forEach(function(track) {
				track.stop();
			});
			delete activeWebCams[deviceId];
		}
	},

	JS_WebCamVideo_GrabFrame__proxy: 'sync',
	JS_WebCamVideo_GrabFrame__sig: 'viiii',
	JS_WebCamVideo_GrabFrame__deps: ['$activeWebCams'],
	JS_WebCamVideo_GrabFrame: function(deviceId, buffer, destWidth, destHeight) {
		var webcam = activeWebCams[deviceId];
		if (!webcam) return;

		// Do not sample a new frame if there cannot be a new video frame available for us. (we would
		// just be capturing the same pixels again, wasting performance)
		var timeNow = performance.now();
		if (timeNow < webcam.nextFrameAvailableTime) {
			return;
		}

		// Calculate when the next video frame will be available.
		webcam.nextFrameAvailableTime += webcam.frameLengthInMsecs;
		// We have lost a lot of time and missed frames? Then reset the calculation for the next frame
		// availability based on present time.
		if (webcam.nextFrameAvailableTime < timeNow) {
			webcam.nextFrameAvailableTime = timeNow + webcam.frameLengthInMsecs;
		}

		var canvas = webcam.canvas;
		if (canvas.width != destWidth || canvas.height != destHeight || !webcam.context2d) {
			canvas.width = destWidth;
			canvas.height = destHeight;
			// Chrome and Firefox bug? After resizing the canvas, the 2D context
			// needs to be reacquired or the resize does not apply.
			webcam.context2d = canvas.getContext('2d');
		}
		var context = webcam.context2d;
		context.drawImage(webcam.video, 0, 0, webcam.video.videoWidth, webcam.video.videoHeight, 0, 0, destWidth, destHeight);
		HEAPU8.set(context.getImageData(0, 0, destWidth, destHeight).data, buffer);
		return 1; // Managed to capture a frame
	}
};

mergeInto(LibraryManager.library, LibraryWebCamWebGL);
