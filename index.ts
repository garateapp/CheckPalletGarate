import { registerRootComponent } from 'expo';
import App from './App';

// registerRootComponent llama a AppRegistry.registerComponent para que
// metro/expo-remote-loading funcione tanto en Expo Go como en builds nativos.
registerRootComponent(App);
