/********************************************************
 * 
 * Macro Author:      	Taylor Hanson
 *                    	Solutions Engineer
 *                    	tahanson@cisco.com
 *                    	Cisco Systems
 * 
 * Version: 1-0-0
 * Released: 06/04/25
 * 
 * This macro lets you easily create and switch between monitor roles
 * 
 * A More extensive macro and information available here, from William Mills:
 * https://github.com/wxsd-sales/room-presets-macro
 * 
 ********************************************************/
import xapi from 'xapi';

/*********************************************************
 * Configure the settings below
**********************************************************/

const config = {
  buttonName: 'Room Presets', // Name for button and page title
  footNote: '🔳 = Auto | 🟩 = Presentation | 🔲 = Recorder',
  presets: [        // Create your array of presets
    {
      name: 'Instructor',          // Name for your preset
      guide: '🟩🟩🔲',
      displays: {
        outputRoles: ['PresentationOnly', 'PresentationOnly', 'Recorder'], // Output roles array
      },
      camera: {
        inputSource: 3,       // Camera 1 | 2 | 3
        speakerTrackBackground: 'Deactivate',     // Activate | Deactivate
        showPresets: true,
        defaultPreset: 2   // default to 2
      }
    },
    {
      name: 'Meeting',
      guide: '🔳🔳🔲',
      displays: {
        outputRoles: ['Auto', 'Auto', 'Recorder'], 
      },
      camera: {
        inputSource: 1,       // Camera 1 | 2 | 3
        speakerTrackBackground: 'Activate',     // Activate | Deactivate
      }
    }
  ]
}

/*********************************************************
 * Main function to setup and add event listeners
**********************************************************/

let currentLayout;

function main() {
  createPanel()
  xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidgets);
  xapi.Status.Video.Layout.CurrentLayouts.AvailableLayouts.on(processLayouts)

}

setTimeout(main, 1000)

function processLayouts(layout) {
  if (layout.ghost) return;
  if (currentLayout == layout.LayoutName) {
    setLayout(currentLayout)
  }
}

function setCamera(camera) {
  console.log('Setting Main Video Source to: ' + camera.inputSource);

  switch (camera.speakerTrackBackground) {
    case 'Activate':
      console.log(`Setting SpeakerTrack BackgroundMode to: [Activate]`);
      xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: camera.inputSource }).then(r=>{
        xapi.Command.Cameras.SpeakerTrack.Activate().catch(e => {
          console.error('Error Activating SpeakerTrack: ' + e.message)
        })
        xapi.Command.Cameras.SpeakerTrack.BackgroundMode.Activate().catch(e => {
          console.error('Error Activating SpeakerTrack BackgroundMode: ' + e.message)
        })
      }).catch(e => console.error('Error Setting MainVideoSource: ' + e.message))
      break;
    case 'Deactivate':
      console.log(`Setting SpeakerTrack BackgroundMode to: [Deactivate]`);
      xapi.Command.Cameras.SpeakerTrack.Deactivate().then(r => {
          xapi.Command.Video.Input.SetMainVideoSource({ ConnectorId: camera.inputSource })
          if (camera.defaultPreset) {
            activateCameraPreset(camera.defaultPreset)
          }
        })
      break;
  }

}

function activateCameraPreset(id) {
  console.log(`Activating Camera Preset [${id}] `)
  xapi.Command.Camera.Preset.Activate({ PresetId: id });
}


function setOutputRoles(roles) {
  roles.forEach((role, index) => {
    const id = index + 1;
    console.log(`Setting Video Output [${id}] Role to: ${role}`)
    xapi.Config.Video.Output.Connector[id].MonitorRole.set(role).catch(e => {
      console.error(`Could not set Output [${id}] to ${role}: ${e.message}`)
    });
  })
}


function setWidgetActive(id) {
  config.presets.forEach((preset, i) => {
    xapi.Command.UserInterface.Extensions.Widget.SetValue(
      { Value: (id == i) ? 'active' : 'inactive', WidgetId: 'room-preset' + i });
  })
}

// Identify the currect state of the device and which 
// configured preset matches and update the UI accordingly 
async function identifyState() {
  console.log('Syncing UI')
  const outputs = await xapi.Config.Video.Output.Connector.get()

  const displays = {
    outputRoles: outputs.map(output => output.MonitorRole),
    monitorRole: await xapi.Config.Video.Monitors.get(),
  }

  const camera = {
    defaultSource: 1,   // Quadcam
    speakerTrack: await xapi.Config.Cameras.SpeakerTrack.Mode.get()
  }

  console.log('Checking Presets')
  config.presets.forEach((preset, i) => {
    if (JSON.stringify(preset.displays) != JSON.stringify(displays)) return;
    if (JSON.stringify(preset.camera) != JSON.stringify(camera)) return;
    console.log(`Preset '${preset.name}' is configured, updating UI`);
    setWidgetActive(i)
  })
}


// Listen for clicks on the buttons
function processWidgets(event) {
  if (event.WidgetId.startsWith("room-preset")) {
    if (event.Type !== 'clicked') return;
    const presetNum = parseInt(event.WidgetId.slice(-1))
    const preset = config.presets[presetNum];
    setWidgetActive(presetNum);
    applyRoomPreset(preset);
    createPanel(presetNum);
  }

  if (event.WidgetId == 'room-camera-presets') {
    if (event.Type !== 'pressed') return;
    console.log(event)
    console.log(`Camera Presets Pressed, id [${event.Value}]`);
    activateCameraPreset(event.Value);
  }
}

function applyRoomPreset(preset) {
  console.log(`Display Preset [${preset.name}] selected`);
  setOutputRoles(preset.displays.outputRoles);
  setCamera(preset.camera);
}

// Here we create the Button and Panel for the UI
async function createPanel(active) {
  let presets = '';
  config.presets.forEach((preset, i) => {
    let widgets = `
        <Widget>
          <WidgetId>room-preset${i}</WidgetId>
          <Type>Button</Type>
          <Name>${preset.name}</Name>
          <Options>size=2</Options>
        </Widget>`;
    if (preset.guide) {
      const guide = `
        <Widget>
          <WidgetId>room-guide${i}</WidgetId>
          <Name>${preset.guide}</Name>
          <Type>Text</Type>
          <Options>size=1;fontSize=normal;align=center</Options>
        </Widget>`;
      widgets = widgets.concat(guide)
    }
    presets = presets.concat(`<Row>${widgets}</Row>`);
  })
  let banner = ''
  let footNote = ''
  if (config.footNote) {
    banner = `
        <Row>
          <Widget>
            <WidgetId>room-banner-presets</WidgetId>
            <Name>Preset</Name>
            <Type>Text</Type>
            <Options>size=2;fontSize=normal;align=center</Options>
          </Widget>
          <Widget>
            <WidgetId>room-banner-displays</WidgetId>
            <Name>Displays</Name>
            <Type>Text</Type>
            <Options>size=1;fontSize=normal;align=center</Options>
          </Widget>
        </Row>`;

    footNote = `
      <Row>
        <Widget>
          <WidgetId>room-footNote</WidgetId>
          <Name>${config.footNote}</Name>
          <Type>Text</Type>
          <Options>size=4;fontSize=small;align=center</Options>
        </Widget>
      </Row>`;
  }

  console.log('Active = ' + active)

  const activePresetCamera = typeof active != 'undefined' ? config.presets[active].camera : false

  console.log(activePresetCamera)
  const showPresets = activePresetCamera.showPresets;
  const inputSource = activePresetCamera.inputSource;

  const cameraPresetList = await xapi.Command.Camera.Preset.List({ CameraId: inputSource })
  // console.log('CameraPreset List: ' + cameraPresetList)
  // console.log('ShowPresets: ' + showPresets)
  // console.log('inputSource: ' + inputSource)

  let cameraPresets = '';
  if (showPresets && cameraPresetList.Preset) {
    let values = ''
    cameraPresetList.Preset.forEach(preset => {
      const value = `
        <Value>
          <Key>${preset.id}</Key>
          <Name>${preset.Name}</Name>
        </Value>`;
      values = values.concat(value)
    })

    cameraPresets = `
      <Row>
        <Widget>
          <WidgetId>room-camera-presets</WidgetId>
          <Type>GroupButton</Type>
          <Options>size=3</Options>
          <ValueSpace>
          ${values}
          </ValueSpace>
        </Widget>
      </Row>`;
  }

  const panel = `
    <Extensions>
      <Panel>
        <Type>Statusbar</Type>
        <Location>HomeScreenAndCallControls</Location>
        <Icon>Tv</Icon>
        <Name>${config.buttonName}</Name>
        <ActivityType>Custom</ActivityType>
        <Page>
          <Name>${config.buttonName}</Name>
          ${banner}
          ${presets}
          ${footNote}
          ${cameraPresets}
          <Options>hideRowNames=1</Options>
        </Page>
      </Panel>
    </Extensions>`
  xapi.Command.UserInterface.Extensions.Panel.Save({ PanelId: 'room-presets' }, panel).then(r => {
    console.log("Panel Saved:");
    console.log(r);
  })
}