import chai from 'chai';
import chaiEnzyme from 'chai-enzyme';
import Enzyme from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';
import sinonChai from 'sinon-chai';

chai.use(chaiEnzyme());
chai.use(sinonChai);

Enzyme.configure({
    adapter: new Adapter()
});
