// MUST be the very first import - required for react-native-gesture-handler on iOS
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
