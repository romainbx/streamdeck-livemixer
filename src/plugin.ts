import streamDeck from "@elgato/streamdeck";
import { GenericVmDial } from "./actions/vm-dial.js";
import { GenericVmMute } from "./actions/vm-mute.js";
import { FxToggle } from "./actions/fx-toggle.js";

streamDeck.actions.registerAction(new GenericVmDial());
streamDeck.actions.registerAction(new GenericVmMute());
streamDeck.actions.registerAction(new FxToggle());
streamDeck.connect();
