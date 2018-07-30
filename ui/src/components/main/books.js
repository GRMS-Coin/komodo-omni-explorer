import React from 'react';
import { hashHistory } from 'react-router';
import ReactTable from 'react-table';
import Store from '../../store';
import TablePaginationRenderer from './pagination';
import { connect } from 'react-redux';
import {
  formatValue,
  sort,
} from 'agama-wallet-lib/src/utils';
import { secondsToString } from 'agama-wallet-lib/src/time';
import translate from '../../util/translate/translate';
import { getOrderbooks } from '../../actions/actionCreators';
import Select from 'react-select';

const BOTTOM_BAR_DISPLAY_THRESHOLD = 15;

class Books extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      books: null,
      pair: '',
      pairs: [],
      asksItemsList: [],
      bidsItemsList: [],
      filteredAsksItemsList: [],
      filteredBidsItemsList: [],
      itemsListColumns: this.generateItemsListColumns(),
      defaultPageSize: 20,
      pageSize: 20,
      showPagination: true,
    };
    this.updatePair = this.updatePair.bind(this);
  }

  componentWillMount() {
    Store.dispatch(getOrderbooks());

    const __books = this.props.Main.orderbooks;
    const _pairs = [];
    let _books = [];

    for (let key in __books) {
      _books.push({
        pair: key,
        data: __books[key],
      });

      if (key.indexOf('KMD/') > -1) {
        _pairs.push({ value: key });
      }
    }

    for (let key in __books) {
      if (key.indexOf('KMD/') === -1) {
        _pairs.push({ value: key });
      }
    }

    if (this.props.input) {
      const formattedPair = this.props.input.replace('-', '/').toUpperCase();

      this.setState({
        pair: formattedPair,
      }, ()=>{
        this.setTableState(__books, _pairs);
      });
    } else {
      this.setState({
        pair: 'BTC/KMD',
      }, ()=>{
        this.setTableState(__books, _pairs);
      });
    }
  }

  renderCoinIcon(coin) {
    return (
      <span>
        <span className="table-coin-icon-wrapper">
          <span className={ `table-coin-icon coin_${coin.toLowerCase()}` }></span>
        </span>
        <span className="table-coin-name">{ coin}</span>
      </span>
    );
  }

  setTableState(__books, _pairs) {
    if (__books &&
        __books[this.state.pair]) {
      this.setState({
        books: __books,
        pairs: _pairs,
        asksItemsList: __books[this.state.pair].asks,
        bidsItemsList: __books[this.state.pair].bids,
        filteredAsksItemsList: this.filterData(__books[this.state.pair].asks, this.state.searchTerm),
        filteredBidsItemsList: this.filterData(__books[this.state.pair].bids, this.state.searchTerm),
      });
    }
  }

  generateItemsListColumns(itemsCount) {
    let columns = [];
    let _col;

    _col = [{
      id: 'coin',
      Header: translate('BOOKS.COIN'),
      Footer: translate('BOOKS.COIN'),
      maxWidth: '250',
      accessor: (item) => this.renderCoinIcon(item.coin),
    },
    { id: 'price',
      Header: translate('BOOKS.PRICE'),
      Footer: translate('BOOKS.PRICE'),
      maxWidth: '250',
      accessor: (item) => item.price,
    },
    { id: 'avevol',
      Header: translate('BOOKS.AVG_VOL'),
      Footer: translate('BOOKS.AVG_VOL'),
      maxWidth: '250',
      accessor: (item) => item.avevolume,
    },
    { id: 'numutxos',
      Header: 'UTXOs',
      Footer: 'UTXOs',
      maxWidth: '250',
      accessor: (item) => item.numutxos,
    },
    { id: 'age',
      Header: translate('BOOKS.AGE'),
      Footer: translate('BOOKS.AGE'),
      maxWidth: '250',
      accessor: (item) => item.age,
    }];

    if (itemsCount <= BOTTOM_BAR_DISPLAY_THRESHOLD) {
      delete _col[0].Footer;
      delete _col[1].Footer;
    }

    columns.push(..._col);

    return columns;
  }

  componentWillReceiveProps(props) {
    const __books = this.props.Main.orderbooks;
    const _pairs = [];
    let _books = [];

    for (let key in __books) {
      _books.push({
        pair: key,
        data: __books[key],
      });

      if (key.indexOf('KMD/') > -1) {
        _pairs.push({ value: key });
      }
    }

    for (let key in __books) {
      if (key.indexOf('KMD/') === -1) {
        _pairs.push({ value: key });
      }
    }

    if (props.input) {
      const formattedPair = props.input.replace('-', '/').toUpperCase();

      this.setState({
        pair: formattedPair,
      }, ()=>{
        this.setTableState(__books, _pairs);
      });

    } else {
      this.setState({
        pair: 'BTC/KMD',
      }, ()=>{
        this.setTableState(__books, _pairs);
      });
    }
  }

  onPageSizeChange(pageSize, pageIndex) {
    this.setState(Object.assign({}, this.state, {
      pageSize: pageSize,
    }));
  }

  filterData(list, searchTerm) {
    return list.filter(item => this.filterDataByProp(item, searchTerm));
  }

  filterDataByProp(item, term) {
    if (!term) {
      return true;
    }

    term = term.toLowerCase();

    return this.contains(item.pair.toLowerCase(), term);
  }

  contains(value, property) {
    return (value + '').indexOf(property) !== -1;
  }

  updatePair(e) {
    if (e &&
        e.value) {
      const __books = this.props.Main.orderbooks;
      const _pair = e.value;

      if (this.props.params) {
        hashHistory.push('/books/' + e.value.replace('/', '-'));
      }

      this.setState({
        pair: _pair,
        asksItemsList: __books[_pair].asks,
        bidsItemsList: __books[_pair].bids,
        filteredAsksItemsList: this.filterData(__books[_pair].asks, this.state.searchTerm),
        filteredBidsItemsList: this.filterData(__books[_pair].bids, this.state.searchTerm),
      });
    }
  }

  renderPairOption(option) {
    const _pair = option.value.split('/');

    return (
      <div className="coin-dropdown">
        <span className="table-coin-icon-wrapper">
          <span className={ `table-coin-icon coin_${_pair[0].toLowerCase()}` }></span>
        </span>
        <span className="table-coin-name">{ _pair[0] }</span>
        <i className="fa fa-exchange exchange-icon"></i>
        <span className="table-coin-icon-wrapper">
          <span className={ `table-coin-icon coin_${_pair[1].toLowerCase()}` }></span>
        </span>
        <span className="table-coin-name">{ _pair[1] }</span>
      </div>
    );
  }

  render() {
    if (this.state.books) {
      return (
        <div>
          <Select
            className="pair"
            name="selectedPair"
            value={ this.state.pair }
            onChange={ (event) => this.updatePair(event) }
            optionRenderer={ this.renderPairOption }
            valueRenderer={ this.renderPairOption }
            options={ this.state.pairs } />
          <div className="books-table-block">
            <div
              className="panel panel-default">
              <div className="panel-heading">
                <strong>{ translate('BOOKS.ASKS') }</strong>
              </div>
              <div className="books-table">
                <ReactTable
                  data={ this.state.filteredAsksItemsList }
                  columns={ this.state.itemsListColumns }
                  minRows="0"
                  sortable={ true }
                  className="-striped -highlight"
                  PaginationComponent={ TablePaginationRenderer }
                  nextText={ translate('INTEREST.NEXT_PAGE') }
                  previousText={ translate('INTEREST.PREVIOUS_PAGE') }
                  showPaginationBottom={ this.state.showPagination }
                  pageSize={ this.state.pageSize }
                  defaultSorted={[{ // default sort
                    id: 'age',
                    desc: false,
                  }]}
                  onPageSizeChange={ (pageSize, pageIndex) => this.onPageSizeChange(pageSize, pageIndex) } />
              </div>
            </div>
            <div className="panel panel-default">
              <div className="panel-heading">
                <strong>{ translate('BOOKS.BIDS') }</strong>
              </div>
              <div className="books-table">
                <ReactTable
                  data={ this.state.filteredBidsItemsList }
                  columns={ this.state.itemsListColumns }
                  minRows="0"
                  sortable={ true }
                  className="-striped -highlight"
                  PaginationComponent={ TablePaginationRenderer }
                  nextText={ translate('INDEX.NEXT_PAGE') }
                  previousText={ translate('INDEX.PREVIOUS_PAGE') }
                  showPaginationBottom={ this.state.showPagination }
                  pageSize={ this.state.pageSize }
                  defaultSorted={[{ // default sort
                    id: 'age',
                    desc: false,
                  }]}
                  onPageSizeChange={ (pageSize, pageIndex) => this.onPageSizeChange(pageSize, pageIndex) } />
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      return(<div>{ translate('INDEX.LOADING') }...</div>);
    }
  }
}

const mapStateToProps = (state, ownProps) => {
  return {
    Main: state.root.Main,
    input: ownProps.params.input,
  };
};

export default connect(mapStateToProps)(Books);