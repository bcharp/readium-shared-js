//  Created by Boris Schneiderman.
//  Copyright (c) 2012-2013 The Readium Foundation.
//
//  The Readium SDK is free software: you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation, either version 3 of the License, or
//  (at your option) any later version.
//
//  This program is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  You should have received a copy of the GNU General Public License
//  along with this program.  If not, see <http://www.gnu.org/licenses/>.

/**
 *
 * Top level View object. Interface for view manipulation public APIs
 *
 * @class ReadiumSDK.Views.ReaderView
 *
 * */
ReadiumSDK.Views.ReaderView = Backbone.View.extend({

    currentView: undefined,
    package: undefined,
    spine: undefined,
    viewerSettings:undefined,
    userStyles: undefined,
                                                   
    initialize: function() {
        
        this.timerDebug = new Date();
        this.viewerSettings = new ReadiumSDK.Models.ViewerSettings({});
        this.userStyles = new ReadiumSDK.Collections.StyleCollection();
    },

    renderCurrentView: function(isReflowable) {
        
        if(this.currentView){

            //current view is already rendered
            if(this.currentView.isReflowable() === isReflowable) {
                return;
            }

            this.resetCurrentView();
        }

        if(isReflowable) {
            this.currentView = new ReadiumSDK.Views.ReflowableView({$viewport: this.$el, spine:this.spine, userStyles: this.userStyles});
        }else {
            this.currentView = new ReadiumSDK.Views.FixedView({$viewport: this.$el, spine:this.spine, userStyles: this.userStyles});
        }

        this.currentView.setViewSettings(this.viewerSettings);

        this.currentView.render();
                                                   
        var self = this;
        this.currentView.on("ViewPaginationChanged", function(){
            var paginationReportData = self.currentView.getPaginationInfo();
            self.trigger("PaginationChanged", paginationReportData);

        });

    },

    resetCurrentView: function() {

        if(!this.currentView) {
            return;
        }

        this.currentView.off("ViewPaginationChanged");
        this.currentView.remove();
        this.currentView = undefined;
    },

    /**
     * Triggers the process of opening the book and requesting resources specified in the packageData
     *
     * @method openBook
     * @param openBookData object with open book data in format:
     * {
     *     package: packageData, (required)
     *     openPageRequest: openPageRequestData, (optional) data related to open page request
     *     settings: readerSettings, (optional)
     *     styles: cssStyles (optional)
     * }
     *
     */
    openBook: function(openBookData, last) {

        this.package = new ReadiumSDK.Models.Package({packageData: openBookData.package});
        this.spine = this.package.spine;

        this.resetCurrentView();

        if(openBookData.settings) {
            this.updateSettings(openBookData.settings);
        }

        if(openBookData.styles) {
            this.setStyles(openBookData.styles);
        }

        if(openBookData.openPageRequest) {
                                                   
            var pageRequestData = openBookData.openPageRequest;
            if(last){
                var spineItem = this.spine.first();
                if(spineItem) {
                    var pageOpenRequest = new ReadiumSDK.Models.PageOpenRequest(spineItem);
                    pageOpenRequest.setLastPage();
                    this.openPage(pageOpenRequest);
                }
            }
            else if(pageRequestData.idref) {

                if(pageRequestData.spineItemPageIndex) {
                    this.openSpineItemPage(pageRequestData.idref, pageRequestData.spineItemPageIndex);
                }
                else if(pageRequestData.elementCfi) {
                    this.openSpineItemElementCfi(pageRequestData.idref, pageRequestData.elementCfi);
                }
                else if(pageRequestData.percent){
                    this.openSpineItemPage(pageRequestData.idref, 0, pageRequestData.percent);
                }
                else{
                    this.openSpineItemPage(pageRequestData.idref, 0);
                }
            }
            else if(pageRequestData.contentRefUrl && pageRequestData.sourceFileHref) {
                this.openContentUrl(pageRequestData.contentRefUrl, pageRequestData.sourceFileHref);
            }
            else {
                console.log("Invalid page request data: idref required!");
            }
        }
        else {// if we where not asked to open specific page we will open the first one

            var spineItem = this.spine.first();
            if(spineItem) {
                var pageOpenRequest = new ReadiumSDK.Models.PageOpenRequest(spineItem);
                pageOpenRequest.setFirstPage();
                this.openPage(pageOpenRequest);
            }

        }
    },

    /**
     * Flips the page from left to right. Takes to account the page progression direction to decide to flip to prev or next page.
     * @method openPageLeft
     */
    openPageLeft: function() {

        if(this.package.spine.isLeftToRight()) {
            this.openPagePrev();
        }
        else {
            this.openPageNext();
        }
    },

    /**
     * Flips the page from right to left. Takes to account the page progression direction to decide to flip to prev or next page.
     * @method openPageRight
     */
    openPageRight: function() {

        if(this.package.spine.isLeftToRight()) {
            this.openPageNext();
        }
        else {
            this.openPagePrev();
        }

    },

    /**
     * Updates reader view based on the settings specified in settingsData object
     * @param settingsData
     */
    updateSettings: function(settingsData) {

        this.viewerSettings.update(settingsData);

        if(this.currentView) {

            var bookMarkPage = this.currentView.bookmarkCurrentPage();
            this.currentView.setViewSettings(this.viewerSettings);
                                                   
            if(bookMarkPage.contentCFI !== undefined)
            {
                this.openSpineItemElementCfi(bookMarkPage.idref, bookMarkPage.contentCFI);
            }
            
        }
                                                   
        this.trigger("SettingsApplied");
    },
                                                   
    getFontPercent: function(){
       return this.currentView.getFontPercent();
    },
    setFontPercent : function(percent){
       this.currentView.setFontPercent(percent);
    },
                                                   
    getFontName : function (){
      return this.currentView.getFontName();
    },
    setFontName : function (fontName){
      this.currentView.setFontName(fontName);
    },
                                                   
    setTheme : function (themeName){
       //console.log("theme : "+themeName);
       this.currentView.setTheme(themeName);
    },
    getTheme : function (){
       return this.currentView.getTheme();
    },
    //from cfi
    getPageForElement: function($element, x, y) {
   
       var elementRect = ReadiumSDK.Helpers.Rect.fromElement($element);
       var posInElement = Math.ceil(elementRect.top + y * elementRect.height / 100);
   
       var column = Math.floor(posInElement / this.currentView.$viewport.height());
   
       return column;
                                                   
    },
    openAnchor: function (anchor)
    {
       if(this.currentView.isReflowable())
       {
           var anc = $("#"+anchor+":last",this.currentView.$epubHtml);
           var offset = anc.offset();
           var position = anc.position();
           
           /*console.log("ancre texte : "+ anchor);
           console.log("ancre class : "+ anc.attr('class'));
           console.log("offset left : "+ offset.left);
           console.log("position left : "+ position.left);
           console.log("column width : "+this.currentView.paginationInfo.columnWidth);
           console.log("page offset : "+this.currentView.paginationInfo.pageOffset);*/
           
            page = Math.floor((this.currentView.paginationInfo.pageOffset + offset.left)/(this.currentView.paginationInfo.columnWidth+this.currentView.paginationInfo.columnGap));
            //console.log("page : "+page);
                                                   
           this.currentView.openPageAtIndex(page);
       }
    },
    /**
     * Opens the next page.
     */
    openPageNext: function() {
        
        var paginationInfo = this.currentView.getPaginationInfo();

        if(paginationInfo.openPages.length == 0) {
            return false;
        }

        var lastOpenPage = paginationInfo.openPages[paginationInfo.openPages.length - 1];

        if(lastOpenPage.spineItemPageIndex < lastOpenPage.spineItemPageCount - 1) {
            this.currentView.openPageNext();
            return true;
        }

        var currentSpineItem = this.spine.getItemById(lastOpenPage.idref);

        var nextSpineItem = this.spine.nextItem(currentSpineItem);

        if(!nextSpineItem) {
            return false;
        }

        var openPageRequest = new ReadiumSDK.Models.PageOpenRequest(nextSpineItem);
        openPageRequest.setFirstPage();

        this.openPage(openPageRequest);
        return true;
    },

    /**
     * Opens the previews page.
     */
    openPagePrev: function() {

        var paginationInfo = this.currentView.getPaginationInfo();

        if(paginationInfo.openPages.length == 0) {
            return false;
        }

        var firstOpenPage = paginationInfo.openPages[0];

        if(firstOpenPage.spineItemPageIndex > 0) {
            this.currentView.openPagePrev();
            return true;
        }

        var currentSpineItem = this.spine.getItemById(firstOpenPage.idref);

        var prevSpineItem = this.spine.prevItem(currentSpineItem);

        if(!prevSpineItem) {
            return false;
        }

        var openPageRequest = new ReadiumSDK.Models.PageOpenRequest(prevSpineItem);
        openPageRequest.setLastPage();

        this.openPage(openPageRequest);
        return true;
    },
                                                   
    openLastPage: function (){
        var openPageRequest = new ReadiumSDK.Models.PageOpenRequest(this.currentSpineItem);
        openPageRequest.setLastPage();
        this.openPage(openPageRequest);
    },

    getSpineItem: function(idref) {

        if(!idref) {

            //console.log("idref parameter value missing!");
            return undefined;
        }

        var spineItem = this.spine.getItemById(idref);
        if(!spineItem) {
            //console.log("Spine item with id " + idref + " not found!");
            return undefined;
        }

        return spineItem;

    },

    /**
     * Opens the page of the spine item with element with provided cfi
     *
     * @method openSpineItemElementCfi
     *
     * @param {string} idref Id of the spine item
     * @param {string} elementCfi CFI of the element to be shown
     */
    openSpineItemElementCfi: function(idref, elementCfi) {

        /*console.log("--- cfi ---");
        console.log(elementCfi);
        console.log(JSON.stringify(elementCfi));
        console.log("--- end cfi ---");*/
                                                   
        var spineItem = this.getSpineItem(idref);

        if(!spineItem) {
            return;
        }

        var pageData = new ReadiumSDK.Models.PageOpenRequest(spineItem);
                                                   
        if(elementCfi) {
            pageData.setElementCfi(elementCfi);
        }
                                                   
        //console.log(JSON.stringify(pageData));
                                                   
        this.openPage(pageData);
    },
    /**
     *
     * Opens specified page index of the current spine item
     *
     * @method openPageIndex
     *
     * @param {number} pageIndex Zero based index of the page in the current spine item
     */
    openPageIndex: function(pageIndex) {

        if(!this.currentView) {
            return;
        }

        var pageRequest;
        if(this.package.isFixedLayout()) {
            var spineItem = this.package.spine.items[pageIndex];
            if(!spineItem) {
                return;
            }

            pageRequest = new ReadiumSDK.Models.PageOpenRequest(spineItem);
            pageRequest.setPageIndex(0);
        }
        else {

            pageRequest = new ReadiumSDK.Models.PageOpenRequest(undefined);
            pageRequest.setPageIndex(pageIndex);
        }

        this.openPage(pageRequest);
    },

    openPage: function(pageRequest) {

        this.renderCurrentView(pageRequest.spineItem.isReflowable());
        this.currentView.openPage(pageRequest);
        //window.location.href = "epubobjc:didDisplayHtml";
    },


    /**
     *
     * Opens page index of the spine item with idref provided
     *
     * @param {string} idref Id of the spine item
     * @param {number} pageIndex Zero based index of the page in the spine item
     */
    openSpineItemPage: function(idref, pageIndex, percent) {

        var spineItem = this.getSpineItem(idref);

        if(!spineItem) {
            return;
        }

        var pageData = new ReadiumSDK.Models.PageOpenRequest(spineItem);
        if(pageIndex) {
            pageData.setPageIndex(pageIndex);
        }
                                                   
        if(percent){
            pageData.percent = percent;
        }

        this.openPage(pageData);
    },

    /**
     * Set CSS Styles to the reader
     *
     * @method setStyles
     *
     * @param styles {object} style object contains selector property and declarations object
     */
    setStyles: function(styles) {

        var count = styles.length;

        for(var i = 0; i < count; i++) {
            this.userStyles.addStyle(styles[i].selector, styles[i].declarations);
        }

        this.applyStyles();

    },

    applyStyles: function() {

        ReadiumSDK.Helpers.setStyles(this.userStyles.styles, this.$el);

        if(this.currentView) {
            this.currentView.applyStyles();
        }
    },


    /**
     * Opens the content document specified by the url
     *
     * @method openContentUrl
     *
     * @param {string} contentRefUrl Url of the content document
     * @param {string | undefined} sourceFileHref Url to the file that contentRefUrl is relative to. If contentRefUrl is
     * relative ot the source file that contains it instead of the package file (ex. TOC file) We have to know the
     * sourceFileHref to resolve contentUrl relative to the package file.
     *
     */
    openContentUrl: function(contentRefUrl, sourceFileHref) {

        var combinedPath = ReadiumSDK.Helpers.ResolveContentRef(contentRefUrl, sourceFileHref);


        var hashIndex = combinedPath.indexOf("#");
        var hrefPart;
        var elementId;
        if(hashIndex >= 0) {
            hrefPart = combinedPath.substr(0, hashIndex);
            elementId = combinedPath.substr(hashIndex + 1);
        }
        else {
            hrefPart = combinedPath;
            elementId = undefined;
        }

        var spineItem = this.spine.getItemByHref(hrefPart);

        if(!spineItem) {
            return;
        }

        var pageData = new ReadiumSDK.Models.PageOpenRequest(spineItem)
        if(elementId){
            pageData.setElementId(elementId);
        }

        this.openPage(pageData);
    },

    /**
     *
     * Returns the bookmark associated with currently opened page.
     *
     * @method bookmarkCurrentPage
     *
     * @returns {string} Stringified ReadiumSDK.Models.BookmarkData object.
     */
    bookmarkCurrentPage: function() {
        return JSON.stringify(this.currentView.bookmarkCurrentPage());
    },

    /**
     * Resets all the custom styles set by setStyle callers at runtime
     *
     * @method resetStyles
     */
    clearStyles: function() {

        var styles = this.userStyles.styles;
        var count = styles.length;

        for(var i = 0; i < count; i++) {

            var style = styles[i];
            var declarations = style.declarations;

            for(var prop in declarations) {
                if(declarations.hasOwnProperty(prop)) {
                    declarations[prop] = '';
                }
            }
        }

        this.applyStyles();

        this.userStyles.clear();
    }

});