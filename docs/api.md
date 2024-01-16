# Gigasaurus API

As with my experience with my previous Ark project, Ark API, I discovered the wiki is not web scraper friendly. The HTML is not semantically consistent and elements do not have ids.
Because of this, I made the decision to manually enter data from the Ark Wiki and store them as static json files in the repository. This approach will reduce the amount of work
spent trying to work around the inconsistencies of HTML tagging on the wiki.

In the docs folder, you can find more information about each data structure is defined and a guide to how build each data.json.

Templates for each data structure will be stored in the `./schemas` folder for anything new to be added. Included will be the type of each piece of data.
Moving forward, will need to create a script to validate all the data with our json schemas.
