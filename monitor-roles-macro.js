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
      }
    },
    {
      name: 'Meeting',
      guide: '🔳🔳🔲',
      displays: {
        outputRoles: ['Auto', 'Auto', 'Recorder'], 
      }
    }
  ]
}

/*********************************************************
 * Main function to setup and add event listeners
**********************************************************/

function main() {
  createPanel()
  xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidgets);
}

setTimeout(main, 1000)


function setOutputRoles(roles) {
  roles.forEach((role, index) => {
    const id = index + 1;
    console.log(`Setting Video Output [${id}] Role to: ${role}`)
    xapi.Config.Video.Output.Connector[id].MonitorRole.set(role)
      .catch(e => console.error(`Could not set Output [${id}] to ${role}: ${e.message}`))
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

  console.log('Checking Presets')
  config.presets.forEach((preset, i) => {
    if (JSON.stringify(preset.displays) != JSON.stringify(displays)) return;
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
}

function applyRoomPreset(preset) {
  console.log(`Display Preset [${preset.name}] selected`);
  setOutputRoles(preset.displays.outputRoles);
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
          <Options>hideRowNames=1</Options>
        </Page>
      </Panel>
    </Extensions>`
  xapi.Command.UserInterface.Extensions.Panel.Save(
    { PanelId: 'room-presets' },
    panel
  ).then(r => {
    console.log("Save message:");
    console.log(r);
  })
}