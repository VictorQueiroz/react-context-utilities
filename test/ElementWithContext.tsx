import { PureComponent } from "react";
import * as React from 'react';
import { withContext } from "../src";

export const VersionContext = React.createContext(1);

class ElementWithContext extends PureComponent<{
    version: number;
}> {
    public render() {
        return (
            <React.Fragment>
                Version is {this.props.version}
            </React.Fragment>
        )
    }
}

export default withContext({
    version: VersionContext
},({version}) => ({version}))(ElementWithContext);
